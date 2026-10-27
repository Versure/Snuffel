// The illustration kit in content/illustrations: the palette comes from the design tokens, every
// template passes the svg checks of content:check, and the keyboard template has the keys and
// finger colours of the typing drill.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { repoRoot } from './check.mjs';
import { externalReferences, svgIssues } from './rules/assets.mjs';
import { elements, localName, parseSvg } from './svg.mjs';

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

  test('three skin tones, each with four palette colours that are tokens', () => {
    const values = new Set(palette.colors.map(({ value }) => value));
    assert.deepEqual(Object.keys(palette.skinTones), ['light', 'medium', 'dark']);
    for (const [tone, parts] of Object.entries(palette.skinTones)) {
      assert.deepEqual(Object.keys(parts), ['skin', 'shade', 'line', 'nail'], tone);
      for (const [part, value] of Object.entries(parts)) {
        assert.ok(values.has(value), `${tone} ${part}: ${value} is not in the palette`);
        const token =
          part === 'skin' ? `--snf-color-skin-${tone}` : `--snf-color-skin-${tone}-${part}`;
        assert.equal(normalizeHex(tokens.get(token) ?? ''), value, token);
      }
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

const templatesDir = join(illustrationsDir, 'templates');
const templateNames = readdirSync(templatesDir)
  .filter((name) => name.endsWith('.svg'))
  .sort();

/** The finger colours of the typing drill: `.finger-<kind> { background: var(--token) }`. */
function drillFingerColors() {
  const css = readFileSync(
    join(repoRoot, 'web', 'src', 'app', 'interactions', 'typing-drill', 'keyboard', 'keyboard.css'),
    'utf8',
  );
  const colors = {};
  for (const [, kind, token] of css.matchAll(
    /\.finger-(\w+)\s*\{\s*background:\s*var\((--snf-[\w-]+)\)/g,
  )) {
    colors[kind] = normalizeHex(tokens.get(token));
  }
  return colors;
}

const attributeOf = (element, name) =>
  element.attributes.find((attribute) => attribute.name === name)?.value;

describe('illustration templates', () => {
  test('the agreed templates exist', () => {
    assert.deepEqual(templateNames, [
      'arrow.svg',
      'card.svg',
      'hand.svg',
      'keyboard-qwerty.svg',
      'label.svg',
      'person-sitting.svg',
      'step-number.svg',
    ]);
  });

  test('every template passes the svg checks of content:check', () => {
    for (const name of templateNames) {
      const file = join(templatesDir, name);
      const svg = readFileSync(file, 'utf8');
      assert.deepEqual(svgIssues(name, svg, statSync(file).size, palette), [], name);
      assert.deepEqual(externalReferences(svg), [], name);
      assert.match(svg, /viewBox="0 0 400 \d+"/, `${name}: viewBox is not 400 wide`);
    }
  });

  test('the palette fingers are the finger colours of the typing drill', () => {
    assert.deepEqual(drillFingerColors(), palette.fingers);
  });

  test('the keyboard template has every key of the drill with its finger and colour', () => {
    const cases = JSON.parse(
      readFileSync(join(repoRoot, 'content', 'schema', 'v1', 'typing-keyboard.cases.json'), 'utf8'),
    );
    const { root } = parseSvg(readFileSync(join(templatesDir, 'keyboard-qwerty.svg'), 'utf8'));
    const keys = [...elements(root)].filter(
      (element) => localName(element.name) === 'rect' && attributeOf(element, 'data-key'),
    );
    const byKey = new Map(keys.map((element) => [attributeOf(element, 'data-key'), element]));
    assert.equal(byKey.size, keys.length, 'a key is drawn twice');
    const colors = drillFingerColors();
    const kind = (finger) => (finger === 'thumb' ? 'thumb' : finger.split('-')[1]);

    const expected = cases.keys.flatMap(({ key, finger }) =>
      key === 'shift'
        ? [
            { id: 'shift-left', finger: 'left-pinky' },
            { id: 'shift-right', finger: 'right-pinky' },
          ]
        : [{ id: key, finger }],
    );
    for (const { id, finger } of expected) {
      const element = byKey.get(id);
      assert.ok(element, `key ${id} is missing`);
      assert.equal(attributeOf(element, 'data-finger'), finger, `finger of ${id}`);
      assert.equal(attributeOf(element, 'fill'), colors[kind(finger)], `colour of ${id}`);
    }
    // The other keys are the empty ones of the drill, cream with a dashed border.
    const empty = keys.filter((element) => !attributeOf(element, 'data-finger'));
    assert.deepEqual(empty.map((element) => attributeOf(element, 'data-key')).sort(), [
      'backspace',
      'caps-lock',
      'enter',
      'tab',
    ]);
    for (const element of empty) assert.equal(attributeOf(element, 'fill'), '#fff6dc');

    // The rows of the cases file (13, 13, 11, 10 keys) lie on one line each, left to right.
    const position = (id) => ({
      x: Number(attributeOf(byKey.get(id), 'x')),
      y: Number(attributeOf(byKey.get(id), 'y')),
    });
    const order = cases.keys.map(({ key }) => key).filter((key) => key.length === 1);
    let start = 0;
    let previousY = -Infinity;
    for (const length of [13, 13, 11, 10]) {
      const row = order.slice(start, start + length).map(position);
      start += length;
      assert.ok(
        row.every(({ y }) => y === row[0].y),
        `row ${start} is not straight`,
      );
      assert.ok(row[0].y > previousY, `row ${start} is not below the previous row`);
      previousY = row[0].y;
      for (let i = 1; i < row.length; i++) assert.ok(row[i].x > row[i - 1].x);
    }
  });
});
