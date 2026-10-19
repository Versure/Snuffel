// Copies the self-hosted fonts from @fontsource into web/public/fonts/ (git-ignored).
// angular.json cannot do this: asset inputs must lie inside the workspace (web/),
// and npm workspaces hoist the packages to the root node_modules.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'web', 'public', 'fonts');
const require = createRequire(join(root, 'web', 'package.json'));

const fonts = {
  bangers: ['bangers-latin-400-normal.woff2'],
  'atkinson-hyperlegible': [
    'atkinson-hyperlegible-latin-400-normal.woff2',
    'atkinson-hyperlegible-latin-700-normal.woff2',
  ],
};

for (const [name, files] of Object.entries(fonts)) {
  const packageDir = dirname(require.resolve(`@fontsource/${name}/package.json`));
  mkdirSync(join(target, name), { recursive: true });
  for (const file of files) {
    copyFileSync(join(packageDir, 'files', file), join(target, file));
  }
  copyFileSync(join(packageDir, 'LICENSE'), join(target, name, 'LICENSE'));
}
console.log(`fonts: copied to ${target}`);
