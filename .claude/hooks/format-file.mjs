// PostToolUse hook for Edit/Write: formats the changed file with Prettier.
// Never blocks; formatting problems surface in `npm run check`.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

const input = JSON.parse(raw || '{}');
const file = input?.tool_input?.file_path;
const formattable = /\.(ts|js|mjs|html|css|json|md|yml|yaml)$/;

if (file && formattable.test(file) && existsSync(file) && !/[\\/]docs[\\/]start[\\/]/.test(file)) {
  try {
    execFileSync('npx', ['--no', '--', 'prettier', '--write', '--ignore-unknown', file], {
      cwd: input?.cwd || process.cwd(),
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
  } catch {
    // Ignore: the check script reports formatting errors.
  }
}

process.exit(0);
