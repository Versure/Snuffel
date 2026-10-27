import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  analyzeSvg,
  cssDeclarations,
  decodeEntities,
  elements,
  isPaletteColor,
  isWholeOpacity,
  loadPalette,
  localName,
  normalizeColor,
  normalizeFontFamily,
  parseSvg,
  textContent,
} from './svg.mjs';

const palette = loadPalette();

describe('svg reader', () => {
  test('parseSvg reads elements, attributes, text, comments and CDATA', () => {
    const { root, declarations } = parseSvg(
      '<?xml version="1.0"?><!-- a > b --><svg viewBox=\'0 0 4 4\' a="x &amp; y"><g><text>a &lt; <tspan>b</tspan><![CDATA[ <c> ]]></text></g><rect/></svg>',
    );
    assert.deepEqual(declarations, []);
    const names = [...elements(root)].map((element) => element.name);
    assert.deepEqual(names, ['svg', 'g', 'text', 'tspan', 'rect']);
    const svg = root.children[0];
    assert.deepEqual(svg.attributes, [
      { name: 'viewBox', value: '0 0 4 4' },
      { name: 'a', value: 'x & y' },
    ]);
    const text = [...elements(root)].find((element) => element.name === 'text');
    assert.equal(textContent(text), 'a < b <c>');
  });

  test('parseSvg records a DOCTYPE with an internal subset and continues after it', () => {
    const { root, declarations } = parseSvg(
      '<!DOCTYPE svg [<!ENTITY a "b">]><svg viewBox="0 0 1 1"/>',
    );
    assert.equal(declarations.length, 1);
    assert.match(declarations[0], /^<!DOCTYPE/);
    assert.deepEqual(
      [...elements(root)].map((element) => element.name),
      ['svg'],
    );
  });

  test('helpers', () => {
    assert.equal(decodeEntities('&#65;&#x42;&quot;&onbekend;'), 'AB"&onbekend;');
    assert.equal(localName('svg:Script'), 'script');
    assert.deepEqual(cssDeclarations('fill: red; /* x */ stroke:#000 !important'), [
      { property: 'fill', value: 'red' },
      { property: 'stroke', value: '#000' },
    ]);
    assert.equal(normalizeColor(' #ABC '), '#aabbcc');
    assert.equal(isPaletteColor('#FFF', palette), true);
    assert.equal(isPaletteColor('currentcolor', palette), true);
    assert.equal(isPaletteColor('#000000', palette), false);
    assert.equal(isPaletteColor('#ffd83d80', palette), false);
    assert.equal(isWholeOpacity('1'), true);
    assert.equal(isWholeOpacity('0%'), true);
    assert.equal(isWholeOpacity('.99'), false);
    assert.equal(
      normalizeFontFamily('"Atkinson Hyperlegible" ,Verdana,  sans-serif'),
      'atkinson hyperlegible, verdana, sans-serif',
    );
  });

  test('analyzeSvg of a clean drawing finds nothing', () => {
    assert.deepEqual(
      analyzeSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100" font-family="Atkinson Hyperlegible, Verdana, sans-serif"><use href="#a"/><text font-weight="700" fill="#141414">Thuisrij</text></svg>',
        palette,
      ),
      { colors: [], unsafe: [], viewBox: null, text: [] },
    );
  });
});
