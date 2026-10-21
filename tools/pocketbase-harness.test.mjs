import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { after, before, describe, test } from 'node:test';
import { freePort, pocketBaseFlags, waitForHealth } from './pocketbase-harness.mjs';

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
