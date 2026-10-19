// PreToolUse hook for Bash: blocks git/gh commands that bypass the review workflow.
// Exit code 2 blocks the tool call; stderr is shown to Claude.
import { execSync } from 'node:child_process';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

const input = JSON.parse(raw || '{}');
const command = String(input?.tool_input?.command ?? '');
const cwd = input?.cwd || process.cwd();

function currentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

function block(reason) {
  console.error(`Blocked by .claude/hooks/guard-git.mjs: ${reason}`);
  process.exit(2);
}

// Split on shell separators so each sub-command is checked on its own.
const parts = command.split(/&&|\|\||;|\|/).map((part) => part.trim());

for (const part of parts) {
  if (/--no-verify\b/.test(part) || /\bHUSKY=0\b/.test(part)) {
    block('git hooks may not be skipped.');
  }
  if (/\bgit\s+config\b.*\bcore\.hooksPath\b/.test(part)) {
    block('changing core.hooksPath disables the git hooks.');
  }
  if (/\bgit\s+reset\b.*--hard\b/.test(part)) {
    block('git reset --hard discards work; ask Jop first.');
  }
  if (/\bgh\s+pr\s+merge\b/.test(part)) {
    block('Jop merges pull requests himself.');
  }
  if (/\bgit\s+push\b/.test(part)) {
    if (/(\s-f\b|--force\b|--force-with-lease\b|\s\+\S)/.test(part)) {
      block('force-push is not allowed.');
    }
    if (/(\s|:)main\b/.test(part)) {
      block('pushing to main is not allowed; push the feature branch and open a pull request.');
    }
    if (currentBranch() === 'main') {
      block('you are on main; switch to a feature branch first.');
    }
  }
  if (/\bgit\s+commit\b/.test(part) && currentBranch() === 'main') {
    block('committing on main is not allowed; switch to a feature branch first.');
  }
}

process.exit(0);
