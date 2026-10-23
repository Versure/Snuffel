// Starts the pinned PocketBase binary on a free port with an empty data directory below
// pocketbase/pb_data/, the migrations and hooks from the repo, and (optionally) a superuser.
// Shared by the integration tests (pocketbase/tests) and the seed tool's tests.
import { execFile, spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fetchPocketBase, rootDir } from './fetch-pocketbase.mjs';

const execFileAsync = promisify(execFile);

export const dataRoot = join(rootDir, 'pocketbase', 'pb_data');
export const migrationsDir = join(rootDir, 'pocketbase', 'pb_migrations');
export const hooksDir = join(rootDir, 'pocketbase', 'pb_hooks');

/** Superuser used by the integration tests; only ever exists in a throwaway data directory. */
export const testSuperuser = Object.freeze({
  email: 'test@snuffel.test',
  password: 'snuffel-test-admin',
});

/** Asks the OS for a free TCP port on 127.0.0.1. */
export function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

/** Flags that point PocketBase at a data directory and the repo's migrations and hooks. */
export function pocketBaseFlags(dataDir) {
  return [
    `--dir=${dataDir}`,
    `--migrationsDir=${migrationsDir}`,
    `--hooksDir=${hooksDir}`,
    '--hooksWatch=false',
  ];
}

/** Creates the superuser, or resets its password, with the PocketBase CLI. */
export async function upsertSuperuser(binary, dataDir, { email, password }) {
  try {
    await execFileAsync(binary, [
      'superuser',
      'upsert',
      email,
      password,
      ...pocketBaseFlags(dataDir),
    ]);
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim();
    throw new Error(`pocketbase superuser upsert failed: ${output || error.message}`, {
      cause: error,
    });
  }
}

/**
 * Polls `<url>/api/health` until it answers 200. Throws after `timeoutMs` with the
 * PocketBase output (from `output()`) in the message, or earlier when `exited()` says so.
 */
export async function waitForHealth(
  url,
  { timeoutMs = 20_000, intervalMs = 100, output = () => '', exited = () => false } = {},
) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no answer';
  while (Date.now() < deadline) {
    if (exited()) {
      throw new Error(`PocketBase exited before ${url} was healthy.\n${output()}`.trim());
    }
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.cause?.code ?? error.message;
    }
    await new Promise((done) => setTimeout(done, intervalMs));
  }
  throw new Error(
    `PocketBase at ${url} was not healthy within ${timeoutMs} ms (${lastError}).\n${output()}`.trim(),
  );
}

/** True when PocketBase (or Node) failed because the port was already taken. */
export function isAddressInUse(error) {
  return /address already in use|EADDRINUSE/i.test(error?.message ?? '');
}

/**
 * Calls `attempt(port)` with a fresh port from `pickPort()` until it succeeds. `freePort()`
 * releases its port before PocketBase binds it, so a parallel test file can take it in
 * between; only that bind conflict is retried, at most `attempts` times in total.
 */
export async function retryOnAddressInUse(
  attempt,
  { attempts = 5, pickPort = freePort, log = () => {} } = {},
) {
  for (let tryNumber = 1; ; tryNumber++) {
    const port = await pickPort();
    try {
      return await attempt(port);
    } catch (error) {
      if (tryNumber >= attempts || !isAddressInUse(error)) throw error;
      log(`Port ${port} was taken before PocketBase could bind it; trying another port.`);
    }
  }
}

/**
 * Starts `pocketbase serve` on `port` and waits until it is healthy.
 * Returns `{ url, kill() }`; on failure the process is ended before the error is thrown.
 */
async function servePocketBase(binary, dataDir, port, timeoutMs) {
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(binary, ['serve', `--http=127.0.0.1:${port}`, ...pocketBaseFlags(dataDir)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => (output += chunk));
  child.stderr.on('data', (chunk) => (output += chunk));
  let exited = false;
  const exit = new Promise((done) =>
    child.on('exit', () => {
      exited = true;
      done();
    }),
  );
  // Never leave a server behind, also not when the test process dies.
  const onExit = () => {
    if (!exited) child.kill('SIGKILL');
  };
  process.on('exit', onExit);

  async function kill() {
    process.off('exit', onExit);
    if (!exited) {
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 5_000);
      await exit;
      clearTimeout(timer);
    }
  }

  try {
    await waitForHealth(url, { timeoutMs, output: () => output, exited: () => exited });
  } catch (error) {
    await kill();
    throw error;
  }
  return { url, kill };
}

/**
 * Starts PocketBase in a new, empty directory below pocketbase/pb_data/test-<id>, on a
 * new port when the first one turns out to be taken.
 * Returns `{ url, dataDir, stop() }`; `stop()` ends the process and removes the directory.
 */
export async function startPocketBase({
  superuser = testSuperuser,
  timeoutMs = 20_000,
  log = () => {},
} = {}) {
  const binary = await fetchPocketBase({ log });
  const id = `${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const dataDir = join(dataRoot, `test-${id}`);
  const removeData = () => rmSync(dataDir, { recursive: true, force: true });
  // Never leave a data directory behind, also not when the test process dies.
  process.on('exit', removeData);

  let server;
  try {
    if (superuser) await upsertSuperuser(binary, dataDir, superuser);
    server = await retryOnAddressInUse(
      (port) => servePocketBase(binary, dataDir, port, timeoutMs),
      { log },
    );
  } catch (error) {
    process.off('exit', removeData);
    removeData();
    throw error;
  }

  async function stop() {
    await server.kill();
    process.off('exit', removeData);
    removeData();
  }
  return { url: server.url, dataDir, stop };
}
