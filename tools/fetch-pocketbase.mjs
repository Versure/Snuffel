// Downloads the pinned PocketBase binary (pocketbase/pocketbase.json) and verifies its sha256.
// Used locally (npm run pocketbase:fetch, e2e) and in deploy/Dockerfile, so version and checksum
// always come from the same file.
//
// Usage: node tools/fetch-pocketbase.mjs [--platform linux_amd64] [--out dir]
// Behind a proxy, Node's fetch needs NODE_USE_ENV_PROXY=1 (and NODE_EXTRA_CA_CERTS for a custom CA).
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { unzipSync } from 'fflate';

export const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
export const configPath = join(rootDir, 'pocketbase', 'pocketbase.json');
export const releaseBaseUrl = 'https://github.com/pocketbase/pocketbase/releases/download';

/** Reads pocketbase/pocketbase.json: `{ version, sha256: { <platform>: <hex> } }`. */
export function loadConfig(path = configPath) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Maps Node's platform/arch to PocketBase's release naming (e.g. `linux_amd64`). */
export function currentPlatform(platform = process.platform, arch = process.arch) {
  const os = platform === 'win32' ? 'windows' : platform;
  const cpu = arch === 'x64' ? 'amd64' : arch;
  return `${os}_${cpu}`;
}

export function binaryName(platform) {
  return platform.startsWith('windows_') ? 'pocketbase.exe' : 'pocketbase';
}

export function defaultOutDir(config = loadConfig()) {
  return join(rootDir, 'pocketbase', 'bin', config.version);
}

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

async function download(url) {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(
      `Download of ${url} failed (${error.cause?.message ?? error.message}). ` +
        'Behind a proxy, set NODE_USE_ENV_PROXY=1 and, for a custom CA, NODE_EXTRA_CA_CERTS.',
      { cause: error },
    );
  }
  if (!response.ok) {
    throw new Error(`Download of ${url} failed: HTTP ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Ensures the pinned PocketBase binary for `platform` exists in `out` and returns its path.
 * Skips the download when the binary is already there. A checksum mismatch always throws
 * and leaves no binary behind.
 */
export async function fetchPocketBase({
  platform = currentPlatform(),
  out,
  config = loadConfig(),
  baseUrl = releaseBaseUrl,
  log = console.log,
} = {}) {
  const expected = config.sha256[platform];
  if (!expected) {
    const supported = Object.keys(config.sha256).join(', ');
    throw new Error(`Unsupported platform "${platform}" for PocketBase. Supported: ${supported}.`);
  }
  const outDir = resolve(out ?? defaultOutDir(config));
  const binary = join(outDir, binaryName(platform));
  if (existsSync(binary)) {
    log(`pocketbase: ${config.version} (${platform}) already in ${outDir}`);
    return binary;
  }

  const file = `pocketbase_${config.version}_${platform}.zip`;
  const url = `${baseUrl}/v${config.version}/${file}`;
  log(`pocketbase: downloading ${url}`);
  const zip = await download(url);

  const actual = sha256(zip);
  if (actual !== expected) {
    throw new Error(`Checksum mismatch for ${file}: expected ${expected}, got ${actual}.`);
  }

  const name = binaryName(platform);
  const entries = unzipSync(zip, { filter: (entry) => entry.name === name });
  const content = entries[name];
  if (!content) {
    throw new Error(`${file} does not contain ${name}.`);
  }

  mkdirSync(outDir, { recursive: true });
  const partial = `${binary}.partial`;
  writeFileSync(partial, content, { mode: 0o755 });
  chmodSync(partial, 0o755);
  renameSync(partial, binary);
  log(`pocketbase: ${config.version} (${platform}) verified and stored in ${outDir}`);
  return binary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: { platform: { type: 'string' }, out: { type: 'string' } },
  });
  try {
    await fetchPocketBase({ platform: values.platform, out: values.out });
  } catch (error) {
    console.error(`pocketbase: ${error.message}`);
    process.exit(1);
  }
}
