// A small svg reader for content:check (M16): enough XML to find elements, attributes, styles and
// text, without a dependency. It never runs or loads anything from the svg. The rules that use it
// are in rules/assets.mjs; the palette and the font rules in content/illustrations/palette.json.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const palettePath = join(
  import.meta.dirname,
  '..',
  '..',
  'content',
  'illustrations',
  'palette.json',
);

/** The palette of content/illustrations/palette.json. */
export function loadPalette(path = palettePath) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Decodes the XML entities `&amp;` … and `&#NN;`/`&#xNN;`; unknown entities stay as they are. */
export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name) => {
    if (name[0] === '#') {
      const code =
        name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : +name.slice(1);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return entities[name.toLowerCase()] ?? match;
  });
}

const tagPattern =
  /<([A-Za-z_][\w:.-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']+))?)*)\s*(\/?)>/y;
const attributePattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g;

/** The local name without a namespace prefix, in lower case (`svg:script` is `script`). */
export function localName(name) {
  return name.slice(name.indexOf(':') + 1).toLowerCase();
}

/**
 * Parses svg text into `{ root, declarations }`: `root` is a document node whose `children` are
 * the top elements; each element is `{ name, attributes: [{ name, value }], children, parent }`,
 * text is `{ text }`. `declarations` lists `<!DOCTYPE …>` and `<!ENTITY …>` found, `instructions`
 * every processing instruction (`<?xml …?>`, `<?xml-stylesheet …?>`). Broken markup is read as
 * well as possible; this is a check, not a validator.
 */
export function parseSvg(text) {
  const root = { name: '#document', attributes: [], children: [], parent: null };
  const declarations = [];
  const instructions = [];
  let current = root;
  let i = 0;
  const addText = (value) => {
    if (value) current.children.push({ text: value });
  };
  while (i < text.length) {
    const lt = text.indexOf('<', i);
    if (lt === -1) {
      addText(decodeEntities(text.slice(i)));
      break;
    }
    addText(decodeEntities(text.slice(i, lt)));
    if (text.startsWith('<!--', lt)) {
      const end = text.indexOf('-->', lt + 4);
      i = end === -1 ? text.length : end + 3;
    } else if (text.startsWith('<![CDATA[', lt)) {
      const end = text.indexOf(']]>', lt + 9);
      addText(text.slice(lt + 9, end === -1 ? text.length : end));
      i = end === -1 ? text.length : end + 3;
    } else if (text.startsWith('<!', lt)) {
      const end = text.indexOf('>', lt);
      declarations.push(text.slice(lt, end === -1 ? text.length : end + 1));
      // A DOCTYPE with an internal subset [ … ] ends after the ]>.
      const subset = text.indexOf('[', lt);
      const subsetEnd = text.indexOf(']>', lt);
      if (subset !== -1 && subsetEnd !== -1 && subset < end) i = subsetEnd + 2;
      else i = end === -1 ? text.length : end + 1;
    } else if (text.startsWith('<?', lt)) {
      const end = text.indexOf('?>', lt);
      instructions.push(text.slice(lt, end === -1 ? text.length : end + 2));
      i = end === -1 ? text.length : end + 2;
    } else if (text.startsWith('</', lt)) {
      const end = text.indexOf('>', lt);
      const name = text.slice(lt + 2, end === -1 ? text.length : end).trim();
      // Close up to the matching element (tolerates a missing end tag).
      let node = current;
      while (node !== root && node.name !== name) node = node.parent;
      if (node !== root) current = node.parent;
      i = end === -1 ? text.length : end + 1;
    } else {
      tagPattern.lastIndex = lt;
      const match = tagPattern.exec(text);
      if (!match) {
        addText('<');
        i = lt + 1;
        continue;
      }
      const [, name, rawAttributes, selfClosing] = match;
      const attributes = [...rawAttributes.matchAll(attributePattern)].map(
        ([, attribute, double, single, bare]) => ({
          name: attribute,
          value: decodeEntities(double ?? single ?? bare ?? ''),
        }),
      );
      const element = { name, attributes, children: [], parent: current };
      current.children.push(element);
      if (!selfClosing) current = element;
      i = tagPattern.lastIndex;
    }
  }
  return { root, declarations, instructions };
}

/** Every element below `node`, depth first. */
export function* elements(node) {
  for (const child of node.children ?? []) {
    if (child.name === undefined) continue;
    yield child;
    yield* elements(child);
  }
}

/** All text below an element, whitespace collapsed. */
export function textContent(node) {
  const parts = [];
  const visit = (child) => {
    if (child.text !== undefined) parts.push(child.text);
    else child.children.forEach(visit);
  };
  node.children.forEach(visit);
  return parts.join('').replace(/\s+/g, ' ').trim();
}

/** The declarations of a CSS text (a style attribute or the body of `<style>`). */
export function cssDeclarations(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...clean.matchAll(/([A-Za-z-]+)\s*:\s*([^;{}]+)/g)].map(([, property, value]) => ({
    property: property.toLowerCase(),
    value: value.replace(/!important/i, '').trim(),
  }));
}

function attribute(element, name) {
  return element.attributes.find((candidate) => candidate.name.toLowerCase() === name)?.value;
}

/** The value of a presentation property on the element itself: style wins over the attribute. */
function ownProperty(element, property) {
  const style = attribute(element, 'style');
  const declared = style
    ? cssDeclarations(style).findLast((declaration) => declaration.property === property)
    : undefined;
  return declared?.value ?? attribute(element, property);
}

/** The value of an inherited property: from the element or the nearest ancestor that sets it. */
function inheritedProperty(element, property) {
  for (let node = element; node && node.name !== '#document'; node = node.parent) {
    const value = ownProperty(node, property);
    if (value !== undefined) return value;
  }
  return undefined;
}

const colorProperties = ['fill', 'stroke', 'stop-color', 'color', 'flood-color', 'lighting-color'];
const opacityProperties = [
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'stop-opacity',
  'flood-opacity',
];
const gradientElements = ['lineargradient', 'radialgradient', 'meshgradient'];
const unsafeElements = [
  'script',
  'foreignobject',
  'image',
  'feimage',
  'iframe',
  'embed',
  'object',
  // Animation: a figure is still (no reduced-motion variant), and set/animate can change a link
  // or a colour after the check.
  'set',
  'animate',
  'animatetransform',
  'animatemotion',
  'animatecolor',
  'discard',
];
// Allowlist: the drawing elements a figure may use. Everything else is refused (an XHTML <img>,
// <a>, <view>, …); gradients and filters are reported as colours outside the palette instead.
const allowedElements = [
  'svg',
  'g',
  'defs',
  'symbol',
  'use',
  'title',
  'desc',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'path',
  'text',
  'tspan',
  'clippath',
  'style',
];
// Namespaces a figure may declare: SVG itself, and xlink for older href attributes.
const allowedNamespaces = ['http://www.w3.org/2000/svg', 'http://www.w3.org/1999/xlink'];
// Attributes that load a file (src, srcset, poster) or change where links point (xml:base).
const loadingAttributes = ['src', 'srcset', 'poster', 'xml:base'];
// CSS functions that load an image, besides url().
const cssLoaders = /(?:image-set|image|src)\s*\(/i;
// Filters and blending change colours outside the palette.
const colorEffectElements = ['filter'];
/** Every `url(…)` in a text, with its target (quotes and spaces removed). */
export function urlTargets(text) {
  return [...text.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/url\(\s*(['"]?)\s*([^)'"]*)/gi)].map(
    ([, , target]) => target.trim(),
  );
}

/** `#fff` and `#FFFFFF` both become `#ffffff`; other values are only lowercased and trimmed. */
export function normalizeColor(value) {
  const color = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(color)) return `#${[...color.slice(1)].map((c) => c + c).join('')}`;
  return color;
}

/** True when a colour value is in the palette or one of its keywords. */
export function isPaletteColor(value, palette) {
  const color = normalizeColor(value);
  if (palette.keywords.some((keyword) => keyword.toLowerCase() === color)) return true;
  return palette.colors.some((entry) => entry.value === color);
}

/** True for an opacity of exactly 0 or 1 (also 0% and 100%). */
export function isWholeOpacity(value) {
  const trimmed = value.trim();
  const number = trimmed.endsWith('%') ? parseFloat(trimmed) / 100 : Number(trimmed);
  return number === 0 || number === 1;
}

/** `font-family` without quotes and with single spaces after commas, lowercased. */
export function normalizeFontFamily(value) {
  return value
    .replace(/["']/g, '')
    .split(',')
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .join(', ')
    .toLowerCase();
}

/** Every presentation declaration in the svg: attributes, style attributes and `<style>`. */
function declarationsOf(root) {
  const found = [];
  for (const element of elements(root)) {
    for (const { name, value } of element.attributes) {
      found.push({ property: name.toLowerCase(), value, element });
    }
    const style = attribute(element, 'style');
    if (style) {
      for (const declaration of cssDeclarations(style)) found.push({ ...declaration, element });
    }
    if (localName(element.name) === 'style') {
      for (const declaration of cssDeclarations(textContent(element))) {
        found.push({ ...declaration, element });
      }
    }
  }
  return found;
}

/**
 * Checks an svg text against the illustration rules. Returns lists of findings (short, readable
 * descriptions such as `fill="#ff0000"`) per kind:
 * `{ colors, unsafe, viewBox, text }` (`viewBox` is a description or null when it is fine).
 */
export function analyzeSvg(svg, palette = loadPalette()) {
  const { root, declarations, instructions } = parseSvg(svg);
  const result = { colors: [], unsafe: [], viewBox: null, text: [] };
  const font = normalizeFontFamily(palette.font.family);
  const weights = new Set([...palette.font.weights, 'normal', 'bold']);

  for (const declaration of declarations) {
    if (/^<!(DOCTYPE|ENTITY)/i.test(declaration)) {
      result.unsafe.push(declaration.slice(0, declaration.search(/\s|>/)).toUpperCase() + '>');
    }
  }

  for (const instruction of instructions) {
    // Only the XML declaration itself; <?xml-stylesheet …?> loads a style sheet.
    if (!/^<\?xml(\s|\?>)/i.test(instruction)) {
      result.unsafe.push(`${instruction.slice(0, instruction.search(/\s|\?>/))}?>`);
    }
  }

  for (const element of elements(root)) {
    const name = localName(element.name);
    if (unsafeElements.includes(name)) result.unsafe.push(`<${element.name}>`);
    else if (element.name.includes(':')) result.unsafe.push(`<${element.name}> (namespace)`);
    else if (
      !allowedElements.includes(name) &&
      !gradientElements.includes(name) &&
      name !== 'stop' &&
      !colorEffectElements.includes(name) &&
      !name.startsWith('fe')
    ) {
      result.unsafe.push(`<${element.name}>`);
    }
    if (colorEffectElements.includes(name) || name.startsWith('fe')) {
      if (name !== 'feimage') result.colors.push(`<${element.name}> (filter)`);
    }
    if (name === 'style') {
      const css = textContent(element);
      if (/@import/i.test(css)) result.unsafe.push('@import');
      if (/@font-face/i.test(css)) result.unsafe.push('@font-face');
      if (css.includes('\\')) result.unsafe.push('\\ in <style>');
      if (cssLoaders.test(css.replace(/\/\*[\s\S]*?\*\//g, '')))
        result.unsafe.push('image-set(), image() of src() in <style>');
      for (const target of urlTargets(css)) {
        if (!target.startsWith('#')) result.unsafe.push(`url(${target})`);
      }
    }
    if (gradientElements.includes(name)) result.colors.push(`<${element.name}> (verloop)`);
    for (const { name: attributeName, value } of element.attributes) {
      const lower = attributeName.toLowerCase();
      if (/^on/.test(localName(attributeName))) result.unsafe.push(`${attributeName}="…"`);
      if (loadingAttributes.includes(lower)) result.unsafe.push(`${attributeName}="${value}"`);
      if (
        (lower === 'xmlns' || lower.startsWith('xmlns:')) &&
        !allowedNamespaces.includes(value.trim())
      ) {
        result.unsafe.push(`${attributeName}="${value}"`);
      }
      if (lower === 'style') {
        if (value.includes('\\')) result.unsafe.push('\\ in style=""');
        if (cssLoaders.test(value)) result.unsafe.push(`style="${value}"`);
      }
      if (/(^|:)href$/.test(lower) && !value.trim().startsWith('#')) {
        result.unsafe.push(`${attributeName}="${value}"`);
      }
      // url(…) in an attribute or a style attribute: only to something in this file (#id).
      for (const target of urlTargets(value)) {
        if (!target.startsWith('#')) result.unsafe.push(`url(${target})`);
      }
    }
  }

  for (const { property, value } of declarationsOf(root)) {
    if (/javascript\s*:/i.test(value)) result.unsafe.push(`${property}="${value}"`);
    else if (/(^|[\s('"])data\s*:/i.test(value)) result.unsafe.push(`${property}="data:…"`);
    if (colorProperties.includes(property)) {
      if (!isPaletteColor(value, palette)) result.colors.push(`${property}="${value}"`);
    } else if (opacityProperties.includes(property)) {
      if (!isWholeOpacity(value)) result.colors.push(`${property}="${value}"`);
    } else if (property === 'font-family') {
      if (normalizeFontFamily(value) !== font) result.text.push(`font-family="${value}"`);
    } else if (property === 'font-weight') {
      if (!weights.has(value.trim().toLowerCase())) result.text.push(`font-weight="${value}"`);
    } else if (property === 'mix-blend-mode' || property === 'filter') {
      if (!(property === 'filter' && value.trim().toLowerCase() === 'none')) {
        result.colors.push(`${property}="${value}"`);
      }
    } else if (property === 'font') {
      result.text.push(`font="${value}" (gebruik font-family en font-weight)`);
    }
  }

  const svgElement = root.children.find((child) => child.name !== undefined);
  if (!svgElement || localName(svgElement.name) !== 'svg') {
    result.viewBox = 'geen <svg>-element bovenaan';
  } else {
    const viewBox = attribute(svgElement, 'viewbox');
    const numbers =
      viewBox
        ?.trim()
        .split(/[\s,]+/)
        .map(Number) ?? [];
    if (viewBox === undefined) result.viewBox = 'geen viewBox';
    else if (numbers.length !== 4 || numbers.some((n) => !Number.isFinite(n))) {
      result.viewBox = `viewBox="${viewBox}" is geen vier getallen`;
    } else if (numbers[2] <= 0 || numbers[3] <= 0) {
      result.viewBox = `viewBox="${viewBox}" heeft geen breedte of hoogte`;
    }
  }

  for (const element of elements(root)) {
    if (localName(element.name) !== 'text') continue;
    const content = textContent(element);
    const length = [...content].length;
    if (length > palette.font.maxTextLength) {
      result.text.push(
        `"${content}" is ${length} tekens (hoogstens ${palette.font.maxTextLength})`,
      );
    }
    if (inheritedProperty(element, 'font-family') === undefined) {
      result.text.push(`<text> "${content}" zonder font-family`);
    }
  }
  return result;
}
