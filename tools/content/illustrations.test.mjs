// The illustration kit in content/illustrations: the palette comes from the design tokens.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { repoRoot } from './check.mjs';

const illustrationsDir = join(repoRoot, 'content', 'illustrations');
const palette = JSON.parse(readFileSync(join(illustrationsDir, 'palette.json'), 'utf8'));
const tokensCss = readFileSync(join(repoRoot, 'web', 'src', 'styles', 'tokens.css'), 'utf8');

/** `#fff` and `#FFFFFF` both become `#ffffff`. */
export function normalizeHex(value) {
  const hex = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(hex)) return `#${[...hex.slice(1)].map((c) => c + c).join('')}`;
  return hex;
}

/**
 * The tokens of the first (light) `:root` block of tokens.css, with `var(--x)` resolved:
 * `Map<name, value>`. A figure is always on the fixed cream card, so only light values count.
 */
export function lightTokens(css) {
  const start = css.indexOf(':root {');
  const block = css.slice(start, css.indexOf('\n}', start));
  const raw = new Map(
    [...block.matchAll(/(--snf-[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [
      name,
      value.trim(),
    ]),
  );
  const resolve = (value, depth = 0) => {
    const ref = /^var\((--snf-[\w-]+)\)$/.exec(value);
    if (!ref || depth > 5) return value;
    return resolve(raw.get(ref[1]) ?? value, depth + 1);
  };
  return new Map([...raw].map(([name, value]) => [name, resolve(value)]));
}

const tokens = lightTokens(tokensCss);

describe('illustration palette', () => {
  test('normalizeHex and lightTokens', () => {
    assert.equal(normalizeHex('#FFF'), '#ffffff');
    assert.equal(normalizeHex('#12804A'), '#12804a');
    const parsed = lightTokens(
      ':root {\n  --snf-color-a: #fff;\n  --snf-color-b: var(--snf-color-a);\n}\n:root.dark {\n  --snf-color-a: #000;\n}\n',
    );
    assert.equal(parsed.get('--snf-color-a'), '#fff');
    assert.equal(parsed.get('--snf-color-b'), '#fff');
  });

  test('every palette colour is the light value of its token in tokens.css', () => {
    assert.ok(palette.colors.length > 0);
    for (const { value, token } of palette.colors) {
      assert.equal(value, normalizeHex(value), `${value} is not written as #rrggbb`);
      assert.ok(tokens.has(token), `${token} is not in tokens.css`);
      assert.equal(normalizeHex(tokens.get(token)), value, `${token} is not ${value}`);
    }
  });

  test('palette colours are unique and the keywords are the agreed ones', () => {
    const values = palette.colors.map(({ value }) => value);
    assert.equal(new Set(values).size, values.length);
    assert.deepEqual(palette.keywords, ['none', 'currentColor', 'transparent']);
  });

  test('every finger colour is a palette colour', () => {
    const values = new Set(palette.colors.map(({ value }) => value));
    assert.deepEqual(Object.keys(palette.fingers).sort(), [
      'index',
      'middle',
      'pinky',
      'ring',
      'thumb',
    ]);
    for (const [finger, value] of Object.entries(palette.fingers)) {
      assert.ok(values.has(value), `${finger}: ${value} is not in the palette`);
    }
  });

  test('the style guide lists every palette colour', () => {
    const guide = readFileSync(join(illustrationsDir, 'README.md'), 'utf8');
    for (const { value } of palette.colors) {
      assert.ok(guide.includes(`\`${value}\``), `README.md does not list ${value}`);
    }
    assert.ok(guide.includes(palette.font.family), 'README.md does not give the font-family');
  });
});
