// `npm start`: PocketBase with the dev superuser and the test accounts, then `ng serve`
// (which proxies /api to PocketBase, see web/proxy.conf.json). Ctrl+C stops both.
//
// Usage: node tools/dev.mjs [<extra ng serve arguments>]
// PocketBase always runs on 127.0.0.1:8092, the target of the proxy in web/proxy.conf.json.
// Data stays in pocketbase/pb_data/dev between runs; delete that directory to start fresh.
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rootDir } from './fetch-pocketbase.mjs';
import { waitForHealth } from './pocketbase-harness.mjs';

export const defaultPocketBasePort = 8092;
export const devDataDir = join(rootDir, 'pocketbase', 'pb_data', 'dev');

/** Everything on the command line goes to ng serve (for example `--port 4201`). */
export function parseDevArgs(argv) {
  return { ngArgs: [...argv] };
}

/**
 * The steps of `npm start`, in order: PocketBase (stays running), the seed (runs once,
 * after PocketBase is healthy), then the Angular dev server (stays running).
 */
export function devSteps({
  pocketBasePort = defaultPocketBasePort,
  ngArgs = [],
  node = process.execPath,
  platform = process.platform,
} = {}) {
  const url = `http://127.0.0.1:${pocketBasePort}`;
  const npm = platform === 'win32' ? 'npm.cmd' : 'npm';
  return [
    {
      name: 'pocketbase',
      kind: 'service',
      command: node,
      args: [
        join(rootDir, 'tools', 'serve-pocketbase.mjs'),
        '--port',
        String(pocketBasePort),
        '--data',
        devDataDir,
        '--keep-data',
        '--dev-superuser',
        '--api-only',
      ],
      healthUrl: url,
    },
    {
      name: 'seed',
      kind: 'once',
      command: node,
      args: [join(rootDir, 'tools', 'seed-pocketbase.mjs'), '--url', url],
    },
    {
      name: 'web',
      kind: 'service',
      command: npm,
      args: ['run', 'start', '-w', 'web', ...(ngArgs.length > 0 ? ['--', ...ngArgs] : [])],
    },
  ];
}

/** Stops a child and everything it started (its process group; on Windows only the child). */
function stopTree(child) {
  try {
    if (process.platform === 'win32') child.kill('SIGTERM');
    else process.kill(-child.pid, 'SIGTERM');
  } catch {
    // Already gone.
  }
}

async function main() {
  const options = parseDevArgs(process.argv.slice(2));

  const running = [];
  let stopping = false;
  const stopAll = (code) => {
    if (stopping) return;
    stopping = true;
    for (const child of running) {
      if (child.exitCode === null) stopTree(child);
    }
    setTimeout(() => process.exit(code), 500).unref();
    process.exitCode = code;
  };
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stopAll(0));

  for (const step of devSteps(options)) {
    if (stopping) return;
    const child = spawn(step.command, step.args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      // Own process group, so that stopping also reaches grandchildren (npm → ng serve).
      detached: process.platform !== 'win32',
    });
    if (step.kind === 'once') {
      const code = await new Promise((done) => child.on('exit', (exitCode) => done(exitCode)));
      if (code !== 0) {
        console.error(`dev: ${step.name} failed (exit code ${code})`);
        stopAll(1);
        return;
      }
      continue;
    }
    running.push(child);
    child.on('exit', (code) => {
      if (!stopping) {
        console.error(`dev: ${step.name} stopped (exit code ${code}); stopping the rest`);
        stopAll(code || 1);
      }
    });
    if (step.healthUrl) {
      try {
        await waitForHealth(step.healthUrl, { timeoutMs: 60_000, exited: () => stopping });
        console.log(`dev: PocketBase runs on ${step.healthUrl} (admin: ${step.healthUrl}/_/)`);
      } catch (error) {
        console.error(`dev: ${error.message}`);
        stopAll(1);
        return;
      }
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
