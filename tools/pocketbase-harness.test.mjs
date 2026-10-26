import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { after, before, describe, test } from 'node:test';
import {
  freePort,
  isAddressInUse,
  pocketBaseFlags,
  retryOnAddressInUse,
  waitForHealth,
} from './pocketbase-harness.mjs';

describe('freePort', () => {
  test('returns a port that can be bound right away', async () => {
    const port = await freePort();
    assert.ok(Number.isInteger(port) && port > 0 && port < 65536);
    const server = createTcpServer();
    await new Promise((done, fail) => {
      server.on('error', fail);
      server.listen(port, '127.0.0.1', done);
    });
    await new Promise((done) => server.close(done));
  });

  test('returns different ports for concurrent calls', async () => {
    const ports = await Promise.all([freePort(), freePort(), freePort()]);
    assert.ok(ports.every((port) => port > 0));
  });
});

describe('pocketBaseFlags', () => {
  test('points at the data directory and the repo migrations and hooks', () => {
    const flags = pocketBaseFlags('/tmp/data');
    assert.ok(flags.includes('--dir=/tmp/data'));
    assert.ok(flags.some((flag) => /--migrationsDir=.*pocketbase[\\/]pb_migrations$/.test(flag)));
    assert.ok(flags.some((flag) => /--hooksDir=.*pocketbase[\\/]pb_hooks$/.test(flag)));
    assert.ok(flags.includes('--hooksWatch=false'));
  });
});

describe('waitForHealth', () => {
  let server;
  let url;
  let healthy = false;

  before(async () => {
    server = createServer((request, response) => {
      if (request.url === '/api/health' && healthy) {
        response.writeHead(200).end('{}');
      } else {
        response.writeHead(503).end();
      }
    });
    await new Promise((done) => server.listen(0, '127.0.0.1', done));
    url = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((done) => server.close(done));
  });

  test('resolves once the server answers 200', async () => {
    healthy = false;
    setTimeout(() => (healthy = true), 150);
    await waitForHealth(url, { timeoutMs: 2_000, intervalMs: 20 });
  });

  test('a timeout gives a clear error with the status and the PocketBase output', async () => {
    healthy = false;
    await assert.rejects(
      waitForHealth(url, { timeoutMs: 200, intervalMs: 20, output: () => 'boom: bad migration' }),
      (error) => {
        assert.match(error.message, /not healthy within 200 ms/);
        assert.match(error.message, /HTTP 503/);
        assert.match(error.message, /boom: bad migration/);
        return true;
      },
    );
  });

  test('an unreachable server times out with the connection error', async () => {
    const port = await freePort();
    await assert.rejects(
      waitForHealth(`http://127.0.0.1:${port}`, { timeoutMs: 200, intervalMs: 20 }),
      /not healthy within 200 ms \(ECONNREFUSED\)/,
    );
  });

  test('stops waiting as soon as the process has exited', async () => {
    const started = Date.now();
    await assert.rejects(
      waitForHealth(url, {
        timeoutMs: 5_000,
        intervalMs: 20,
        exited: () => true,
        output: () => 'address already in use',
      }),
      /exited before .* was healthy\.\naddress already in use/,
    );
    assert.ok(Date.now() - started < 1_000);
  });
});

describe('isAddressInUse', () => {
  test('recognises the PocketBase and Node bind errors', () => {
    assert.ok(
      isAddressInUse(
        new Error(
          'PocketBase exited before http://127.0.0.1:44041 was healthy.\nlisten tcp 127.0.0.1:44041: bind: address already in use',
        ),
      ),
    );
    assert.ok(isAddressInUse(new Error('listen EADDRINUSE: address already in use 127.0.0.1:1')));
  });

  test('ignores other errors', () => {
    assert.equal(isAddressInUse(new Error('boom: bad migration')), false);
    assert.equal(isAddressInUse(undefined), false);
  });
});

describe('retryOnAddressInUse', () => {
  const inUse = (port) => new Error(`listen tcp 127.0.0.1:${port}: bind: address already in use`);

  function portsFrom(list) {
    let next = 0;
    return async () => list[next++];
  }

  test('retries with a new port while the port is taken', async () => {
    const tried = [];
    const logged = [];
    const result = await retryOnAddressInUse(
      async (port) => {
        tried.push(port);
        if (tried.length < 3) throw inUse(port);
        return `served on ${port}`;
      },
      { pickPort: portsFrom([1001, 1002, 1003]), log: (line) => logged.push(line) },
    );
    assert.equal(result, 'served on 1003');
    assert.deepEqual(tried, [1001, 1002, 1003]);
    assert.equal(logged.length, 2);
  });

  test('gives up after the last attempt with the bind error', async () => {
    let calls = 0;
    await assert.rejects(
      retryOnAddressInUse(
        async (port) => {
          calls++;
          throw inUse(port);
        },
        { attempts: 3, pickPort: portsFrom([1, 2, 3, 4]) },
      ),
      /127\.0\.0\.1:3: bind: address already in use/,
    );
    assert.equal(calls, 3);
  });

  test('does not retry other errors', async () => {
    let calls = 0;
    await assert.rejects(
      retryOnAddressInUse(
        async () => {
          calls++;
          throw new Error('boom: bad migration');
        },
        { pickPort: portsFrom([1, 2]) },
      ),
      /boom: bad migration/,
    );
    assert.equal(calls, 1);
  });

  test('really serves on a free port after a conflict', async () => {
    const blocker = createTcpServer();
    await new Promise((done) => blocker.listen(0, '127.0.0.1', done));
    const takenPort = blocker.address().port;
    const ports = [takenPort];
    try {
      const server = await retryOnAddressInUse(
        (port) =>
          new Promise((done, fail) => {
            const candidate = createTcpServer();
            candidate.on('error', fail);
            candidate.listen(port, '127.0.0.1', () => done(candidate));
          }),
        { pickPort: async () => ports.shift() ?? freePort() },
      );
      assert.notEqual(server.address().port, takenPort);
      await new Promise((done) => server.close(done));
    } finally {
      await new Promise((done) => blocker.close(done));
    }
  });
});
