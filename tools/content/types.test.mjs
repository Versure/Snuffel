import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { schemaDir } from './schema.mjs';
import { runTool } from './test-helpers.mjs';
import { generateTypes, splitDeclarations, typesFile, typesScript } from './types.mjs';

const committed = readFileSync(typesFile, 'utf8');

describe('content:types', () => {
  test('the committed types are up to date', async () => {
    assert.equal(await generateTypes(), committed);
    const { code, stdout } = await runTool(typesScript, ['--check']);
    assert.equal(code, 0);
    assert.match(stdout, /actueel/);
  });

  test('--check fails after a schema change', async (t) => {
    const schemas = mkdtempSync(join(tmpdir(), 'snuffel-schemas-'));
    t.after(() => rmSync(schemas, { recursive: true, force: true }));
    cpSync(schemaDir, schemas, { recursive: true });
    const termsPath = join(schemas, 'terms.schema.json');
    const terms = JSON.parse(readFileSync(termsPath, 'utf8'));
    terms.$defs.term.properties.note = { type: 'string' };
    writeFileSync(termsPath, JSON.stringify(terms));
    const { code, stderr } = await runTool(typesScript, ['--check', '--schemas', schemas]);
    assert.equal(code, 1);
    assert.match(stderr, /content\.types\.ts is verouderd: draai npm run content:types/);
    assert.equal(readFileSync(typesFile, 'utf8'), committed, '--check never writes');
  });

  test('the types have a header and no index signature', () => {
    assert.match(
      committed,
      /^\/\/ Generated from content\/schema\/v1 by `npm run content:types`\. Do not edit\./,
    );
    assert.doesNotMatch(committed, /\[k: string\]/);
    assert.doesNotMatch(committed, /\bany\b/);
  });

  test('the types export the names the app uses', () => {
    for (const name of [
      'Course',
      'CourseLesson',
      'Source',
      'Lesson',
      'LessonStep',
      'ExplainStep',
      'InteractionStep',
      'QuizStep',
      'PracticeStep',
      'Block',
      'SignalCard',
      'Interaction',
      'TraceGameConfig',
      'ShapePart',
      'SteppedExerciseConfig',
      'ExerciseAnswer',
      'ContentManifest',
      'ManifestCourse',
      'ManifestLesson',
      'Terms',
      'TedMood',
    ]) {
      assert.match(committed, new RegExp(`^export (type|interface) ${name}\\b`, 'm'), name);
    }
  });

  test('splitDeclarations keeps property comments inside their declaration', () => {
    const source = [
      'export type A = string',
      '/**',
      ' * About B.',
      ' */',
      'export interface B {',
      '/**',
      ' * About x.',
      ' */',
      'x: A',
      '}',
      'export type C = (B | A)',
      '',
    ].join('\n');
    assert.deepEqual(
      splitDeclarations(source).map(({ name, text }) => [name, text.split('\n').length]),
      [
        ['A', 1],
        ['B', 9],
        ['C', 1],
      ],
    );
  });
});
