import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { rootDir } from './fetch-pocketbase.mjs';
import { defaultPocketBasePort, devDataDir, devSteps, parseDevArgs } from './dev.mjs';

describe('parseDevArgs', () => {
  test('passes every argument on to ng serve', () => {
    assert.deepEqual(parseDevArgs([]), { ngArgs: [] });
    assert.deepEqual(parseDevArgs(['--port', '4201']), { ngArgs: ['--port', '4201'] });
  });

  test('PocketBase runs on 8092, the target of the ng serve proxy for /api', () => {
    assert.equal(defaultPocketBasePort, 8092);
    const proxy = JSON.parse(readFileSync(join(rootDir, 'web', 'proxy.conf.json'), 'utf8'));
    assert.equal(proxy['/api'].target, `http://127.0.0.1:${defaultPocketBasePort}`);
    const angular = JSON.parse(readFileSync(join(rootDir, 'web', 'angular.json'), 'utf8'));
    assert.equal(angular.projects.snuffel.architect.serve.options.proxyConfig, 'proxy.conf.json');
  });
});

describe('package.json', () => {
  test('the start:lan script passes --host 0.0.0.0 to ng serve', () => {
    const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
    assert.equal(pkg.scripts['start:lan'], 'node tools/dev.mjs --host 0.0.0.0');
    const [, script, ...argv] = pkg.scripts['start:lan'].split(' ');
    assert.equal(script, 'tools/dev.mjs');
    const { ngArgs } = parseDevArgs(argv);
    const web = devSteps({ ngArgs, platform: 'linux' }).find((step) => step.name === 'web');
    assert.deepEqual(web.args, ['run', 'start', '-w', 'web', '--', '--host', '0.0.0.0']);
  });
});

describe('devSteps', () => {
  const steps = devSteps({ node: 'node', platform: 'linux' });

  test('starts PocketBase, then the seed, the content and the Angular dev server', () => {
    assert.deepEqual(
      steps.map(({ name, kind }) => [name, kind]),
      [
        ['pocketbase', 'service'],
        ['seed', 'once'],
        ['content', 'once'],
        ['web', 'service'],
      ],
    );
  });

  test('content is built with fixtures before the web step', () => {
    const content = steps.find((step) => step.name === 'content');
    assert.ok(steps.indexOf(content) < steps.findIndex((step) => step.name === 'web'));
    assert.equal(content.command, 'node');
    assert.match(content.args[0], /tools[\\/]content[\\/]build\.mjs$/);
    assert.deepEqual(content.args.slice(1), ['--fixtures']);
  });

  test('PocketBase keeps its data in pocketbase/pb_data/dev, with the dev superuser and no app', () => {
    const [pocketbase] = steps;
    assert.match(pocketbase.args[0], /tools[\\/]serve-pocketbase\.mjs$/);
    assert.deepEqual(pocketbase.args.slice(1), [
      '--port',
      '8092',
      '--data',
      devDataDir,
      '--keep-data',
      '--dev-superuser',
      '--api-only',
    ]);
    assert.match(devDataDir, /pocketbase[\\/]pb_data[\\/]dev$/);
    assert.equal(pocketbase.healthUrl, 'http://127.0.0.1:8092');
  });

  test('the seed goes to the same PocketBase', () => {
    const seed = steps[1];
    assert.match(seed.args[0], /tools[\\/]seed-pocketbase\.mjs$/);
    assert.deepEqual(seed.args.slice(1), ['--url', 'http://127.0.0.1:8092']);
  });

  test('the dev server is the web workspace start script, with extra arguments after --', () => {
    assert.deepEqual(steps[3].args, ['run', 'start', '-w', 'web']);
    const withArgs = devSteps({ ngArgs: ['--open'], platform: 'linux' })[3];
    assert.deepEqual(withArgs.args, ['run', 'start', '-w', 'web', '--', '--open']);
  });

  test('a different PocketBase port is used everywhere', () => {
    const custom = devSteps({ pocketBasePort: 9000, platform: 'linux' });
    assert.ok(custom[0].args.includes('9000'));
    assert.equal(custom[0].healthUrl, 'http://127.0.0.1:9000');
    assert.deepEqual(custom[1].args.slice(1), ['--url', 'http://127.0.0.1:9000']);
  });

  test('uses npm.cmd on Windows', () => {
    assert.equal(devSteps({ platform: 'win32' })[3].command, 'npm.cmd');
    assert.equal(steps[3].command, 'npm');
  });
});
