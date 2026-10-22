// `npm run content:types`: generates the TypeScript types of the content format from the JSON
// schemas in content/schema/v1/ into web/src/app/core/content/content.types.ts.
// `--check` only compares (in memory) and fails when the committed file is out of date.
//
// Usage: node tools/content/types.mjs [--check] [--schemas <dir>] [--out <file>]
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { compile } from 'json-schema-to-typescript';
import * as prettier from 'prettier';
import { repoRoot } from './check.mjs';
import { schemaDir, schemaKinds } from './schema.mjs';

export const typesFile = join(repoRoot, 'web', 'src', 'app', 'core', 'content', 'content.types.ts');

const header = `// Generated from content/schema/v1 by \`npm run content:types\`. Do not edit.
// Change the schemas instead; \`npm run check\` fails when this file is out of date.
`;

/**
 * Splits generated TypeScript into top-level declarations (each with its JSDoc comment):
 * `[{ name, text }]`.
 */
export function splitDeclarations(source) {
  const chunks = [];
  let current = null;
  let pendingComment = false;
  let inComment = false;
  let depth = 0;
  for (const line of source.split('\n')) {
    const commentLine = inComment || line.trimStart().startsWith('/**');
    if (depth === 0 && line.startsWith('/**')) {
      current = { name: '', lines: [] };
      chunks.push(current);
      pendingComment = true;
    }
    const declaration = depth === 0 ? /^export (?:type|interface) (\w+)/.exec(line) : null;
    if (declaration) {
      if (!(current && pendingComment)) {
        current = { name: '', lines: [] };
        chunks.push(current);
      }
      current.name = declaration[1];
      pendingComment = false;
    }
    if (current) current.lines.push(line);
    if (commentLine) {
      inComment = !line.includes('*/');
    } else {
      depth += (line.match(/{/g) ?? []).length - (line.match(/}/g) ?? []).length;
    }
  }
  return chunks
    .filter((chunk) => chunk.name)
    .map((chunk) => ({ name: chunk.name, text: chunk.lines.join('\n').trim() }));
}

/** Generates the types file content (formatted with the repository's Prettier config). */
export async function generateTypes({ schemas = schemaDir, out = typesFile } = {}) {
  const declarations = new Map();
  for (const kind of schemaKinds) {
    const schema = JSON.parse(readFileSync(join(schemas, `${kind}.schema.json`), 'utf8'));
    const source = await compile(schema, schema.title, {
      bannerComment: '',
      additionalProperties: false,
      ignoreMinAndMaxItems: true,
      unreachableDefinitions: false,
      format: false,
      cwd: schemas,
    });
    for (const { name, text } of splitDeclarations(source)) {
      const existing = declarations.get(name);
      if (existing === undefined) declarations.set(name, text);
      else if (existing !== text) {
        throw new Error(`type ${name} is defined differently in two schemas`);
      }
    }
  }
  const body = `${header}\n${[...declarations.values()].join('\n\n')}\n`;
  const config = (await prettier.resolveConfig(out)) ?? {};
  return prettier.format(body, { ...config, filepath: out });
}

export function parseTypesArgs(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      check: { type: 'boolean', default: false },
      schemas: { type: 'string' },
      out: { type: 'string' },
    },
  });
  return {
    check: values.check,
    schemas: values.schemas ? resolve(values.schemas) : schemaDir,
    out: values.out ? resolve(values.out) : typesFile,
  };
}

async function main() {
  const options = parseTypesArgs(process.argv.slice(2));
  const generated = await generateTypes(options);
  if (options.check) {
    let current = '';
    try {
      current = readFileSync(options.out, 'utf8');
    } catch {
      current = '';
    }
    if (current !== generated) {
      console.error('content.types.ts is verouderd: draai npm run content:types');
      process.exit(1);
    }
    console.log('content:types: content.types.ts is actueel');
    return;
  }
  writeFileSync(options.out, generated);
  console.log(`content:types: ${options.out} geschreven`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

export const typesScript = fileURLToPath(import.meta.url);
