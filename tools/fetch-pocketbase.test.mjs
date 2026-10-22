import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { strToU8, zipSync } from 'fflate';
import { binaryName, currentPlatform, fetchPocketBase, loadConfig } from './fetch-pocketbase.mjs';

const platform = 'linux_amd64';
const version = '9.9.9';
const binaryContent = '#!/bin/sh\necho fake pocketbase\n';
const zip = zipSync({
  pocketbase: strToU8(binaryContent),
  'CHANGELOG.md': strToU8('changes'),
});
const zipSha = createHash('sha256').update(zip).digest('hex');

let server;
let baseUrl;
let requests = 0;
let workDir;

before(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'snuffel-fetch-pb-'));
  server = createServer((request, response) => {
    requests += 1;
    if (request.url === `/v${version}/pocketbase_${version}_${platform}.zip`) {
      response.writeHead(200, { 'content-type': 'application/zip' });
      response.end(Buffer.from(zip));
    } else {
      response.writeHead(404).end();
    }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((done) => server.close(done));
  rmSync(workDir, { recursive: true, force: true });
});

function config(sha = zipSha) {
  return { version, sha256: { [platform]: sha } };
}

function outDir(name) {
  return join(workDir, name);
}

const quiet = () => {};

describe('fetchPocketBase', () => {
  test('a correct checksum gives an extracted, executable binary', async () => {
    const out = outDir('ok');
    const binary = await fetchPocketBase({ platform, out, config: config(), baseUrl, log: quiet });
    assert.equal(binary, join(out, 'pocketbase'));
    assert.equal(readFileSync(binary, 'utf8'), binaryContent);
    // Windows has no executable bit (chmod only toggles read-only); there the extension decides.
    if (process.platform !== 'win32') {
      assert.ok(statSync(binary).mode & 0o100, 'binary is executable');
    }
    assert.ok(!existsSync(join(out, 'CHANGELOG.md')), 'only the binary is extracted');
  });

  test('a wrong checksum aborts and leaves no binary behind', async () => {
    const out = outDir('bad');
    await assert.rejects(
      fetchPocketBase({ platform, out, config: config('0'.repeat(64)), baseUrl, log: quiet }),
      /Checksum mismatch/,
    );
    assert.ok(!existsSync(join(out, 'pocketbase')));
    assert.ok(!existsSync(join(out, 'pocketbase.partial')));
  });

  test('an existing binary is not downloaded again', async () => {
    const out = outDir('existing');
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'pocketbase'), 'already here');
    const before = requests;
    const binary = await fetchPocketBase({ platform, out, config: config(), baseUrl, log: quiet });
    assert.equal(requests, before, 'no request made');
    assert.equal(readFileSync(binary, 'utf8'), 'already here');
  });

  test('an unknown platform gives a clear error', async () => {
    await assert.rejects(
      fetchPocketBase({ platform: 'plan9_386', out: outDir('unknown'), config: config(), baseUrl }),
      /Unsupported platform "plan9_386".*Supported: linux_amd64/,
    );
  });

  test('a failed download gives a clear error', async () => {
    await assert.rejects(
      fetchPocketBase({
        platform,
        out: outDir('missing'),
        config: config(),
        baseUrl: `${baseUrl}/nothing`,
        log: quiet,
      }),
      /HTTP 404/,
    );
  });
});

describe('platform helpers', () => {
  test('map Node names to PocketBase names', () => {
    assert.equal(currentPlatform('linux', 'x64'), 'linux_amd64');
    assert.equal(currentPlatform('darwin', 'arm64'), 'darwin_arm64');
    assert.equal(currentPlatform('win32', 'x64'), 'windows_amd64');
    assert.equal(binaryName('windows_amd64'), 'pocketbase.exe');
    assert.equal(binaryName('linux_arm64'), 'pocketbase');
  });
});

describe('pocketbase/pocketbase.json', () => {
  const pinned = loadConfig();

  test('has a semver version', () => {
    assert.match(pinned.version, /^\d+\.\d+\.\d+$/);
  });

  test('has a sha256 of 64 hex characters for every platform', () => {
    const platforms = [
      'linux_amd64',
      'linux_arm64',
      'darwin_amd64',
      'darwin_arm64',
      'windows_amd64',
    ];
    assert.deepEqual(Object.keys(pinned.sha256).sort(), [...platforms].sort());
    for (const name of platforms) {
      assert.match(pinned.sha256[name], /^[0-9a-f]{64}$/, name);
    }
  });
});
