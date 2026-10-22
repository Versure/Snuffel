// JSON Schema validation of content (format v1), with Dutch messages.
// The schemas live in content/schema/v1/; ajv runs in strict mode, so a schema mistake fails loudly.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

export const schemaDir = join(import.meta.dirname, '..', '..', 'content', 'schema', 'v1');
export const schemaKinds = ['course', 'lesson', 'manifest', 'terms'];

const ID_PATTERN = '^[a-z0-9]+(-[a-z0-9]+)*$';
const TEXT_PATTERN = '\\S';
const HTTPS_PATTERN = '^https://\\S+$';
const DATE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$';

export function loadSchema(kind) {
  return JSON.parse(readFileSync(join(schemaDir, `${kind}.schema.json`), 'utf8'));
}

let validators;

/** Compiles all schemas once (strict mode, every error, discriminator-aware oneOf). */
export function compileSchemas() {
  if (validators) return validators;
  const ajv = new Ajv2020({ strict: true, allErrors: true, discriminator: true });
  validators = Object.fromEntries(schemaKinds.map((kind) => [kind, ajv.compile(loadSchema(kind))]));
  return validators;
}

/** `/steps/0/blocks/1` (JSON pointer) → `steps[0].blocks[1]`. */
export function pointerToPath(pointer, extra) {
  const segments = pointer
    .split('/')
    .slice(1)
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  if (extra !== undefined) segments.push(extra);
  return segments.reduce(
    (path, segment) =>
      /^\d+$/.test(segment) ? `${path}[${segment}]` : path ? `${path}.${segment}` : segment,
    '',
  );
}

const typeNames = {
  string: 'tekst',
  number: 'getal',
  integer: 'geheel getal',
  boolean: 'ja/nee-waarde',
  object: 'object',
  array: 'lijst',
  null: 'null',
};

function lastKey(pointer) {
  const parts = pointer.split('/');
  return parts[parts.length - 1];
}

function show(value) {
  return JSON.stringify(value);
}

/** One ajv error → `{ code, path, message }` in Dutch (falls back to the ajv text). */
function translate(error, data) {
  const { keyword, params, instancePath } = error;
  const key = lastKey(instancePath);
  switch (keyword) {
    case 'required':
      return {
        code: 'schema',
        path: pointerToPath(instancePath, params.missingProperty),
        message: `verplicht veld "${params.missingProperty}" ontbreekt`,
      };
    case 'additionalProperties':
      return {
        code: 'schema',
        path: pointerToPath(instancePath, params.additionalProperty),
        message: `onbekend veld "${params.additionalProperty}" (tikfout in de naam?)`,
      };
    case 'enum':
      return {
        code: 'schema',
        path: pointerToPath(instancePath),
        message: `waarde ${show(valueAt(data, instancePath))} is niet toegestaan; kies uit: ${params.allowedValues.join(', ')}`,
      };
    case 'type':
      return {
        code: 'schema',
        path: pointerToPath(instancePath),
        message: `moet een ${String(params.type)
          .split(',')
          .map((type) => typeNames[type] ?? type)
          .join(' of een ')} zijn`,
      };
    case 'const':
      return {
        code: 'schema',
        path: pointerToPath(instancePath),
        message: `moet ${show(params.allowedValue)} zijn, niet ${show(valueAt(data, instancePath))}`,
      };
    case 'pattern': {
      const value = valueAt(data, instancePath);
      if (params.pattern === ID_PATTERN) {
        return {
          code: 'schema',
          path: pointerToPath(instancePath),
          message: `ongeldig id ${show(value)}: alleen kleine letters, cijfers en losse streepjes (bijv. "aanbeet-of-vastzitten")`,
        };
      }
      if (params.pattern === TEXT_PATTERN) {
        return emptyText(instancePath, key);
      }
      if (params.pattern === HTTPS_PATTERN) {
        return {
          code: 'link-not-https',
          path: pointerToPath(instancePath),
          message: `link ${show(value)} moet beginnen met https:// (en geen spaties bevatten)`,
        };
      }
      if (params.pattern === DATE_PATTERN) {
        return {
          code: 'schema',
          path: pointerToPath(instancePath),
          message: `datum ${show(value)} moet de vorm JJJJ-MM-DD hebben`,
        };
      }
      return {
        code: 'schema',
        path: pointerToPath(instancePath),
        message: `${show(value)} heeft niet de juiste vorm (patroon ${params.pattern})`,
      };
    }
    case 'minLength':
      if (params.limit === 1) return emptyText(instancePath, key);
      return {
        code: 'schema',
        path: pointerToPath(instancePath),
        message: `moet minstens ${params.limit} tekens hebben`,
      };
    case 'maxLength':
      return {
        code: 'schema',
        path: pointerToPath(instancePath),
        message: `mag hoogstens ${params.limit} tekens hebben`,
      };
    case 'minItems':
      return {
        code: 'schema',
        path: pointerToPath(instancePath),
        message: `moet minstens ${params.limit} ${params.limit === 1 ? 'item' : 'items'} hebben`,
      };
    case 'maxItems':
      return {
        code: 'schema',
        path: pointerToPath(instancePath),
        message: `mag hoogstens ${params.limit} ${params.limit === 1 ? 'item' : 'items'} hebben`,
      };
    case 'minimum':
    case 'exclusiveMinimum':
    case 'maximum':
    case 'exclusiveMaximum': {
      const words = {
        minimum: 'minstens',
        exclusiveMinimum: 'groter dan',
        maximum: 'hoogstens',
        exclusiveMaximum: 'kleiner dan',
      };
      return {
        code: 'schema',
        path: pointerToPath(instancePath),
        message: `moet ${words[keyword]} ${params.limit} zijn, niet ${show(valueAt(data, instancePath))}`,
      };
    }
    case 'discriminator':
      return {
        code: 'schema',
        path: pointerToPath(instancePath, params.tag),
        message:
          params.error === 'tag'
            ? `veld "${params.tag}" ontbreekt of is geen tekst`
            : `onbekende soort ${show(params.tagValue)} in "${params.tag}"`,
      };
    case 'false schema':
      return {
        code: 'schema',
        path: pointerToPath(instancePath),
        message: `veld "${key}" mag hier niet staan (een geplande les heeft bijv. nog geen file)`,
      };
    default:
      return {
        code: 'schema',
        path: pointerToPath(instancePath),
        message: `${error.message} (${keyword})`,
      };
  }
}

function emptyText(instancePath, key) {
  if (key === 'alt') {
    return {
      code: 'figure-alt-missing',
      path: pointerToPath(instancePath),
      message: 'de alt-tekst van een afbeelding mag niet leeg zijn',
    };
  }
  return { code: 'schema', path: pointerToPath(instancePath), message: 'mag niet leeg zijn' };
}

function valueAt(data, pointer) {
  let value = data;
  for (const part of pointer.split('/').slice(1)) {
    if (value === null || typeof value !== 'object') return undefined;
    value = value[part.replace(/~1/g, '/').replace(/~0/g, '~')];
  }
  return value;
}

/**
 * Validates `data` against the schema of `kind` (course, lesson, manifest, terms).
 * Returns a list of `{ code, path, message }`; empty when valid.
 */
export function validate(kind, data) {
  const validator = compileSchemas()[kind];
  if (!validator) throw new Error(`unknown schema kind: ${kind}`);
  if (validator(data)) return [];
  const seen = new Set();
  const result = [];
  for (const error of validator.errors ?? []) {
    // `if` only says "then failed"; the `then` error itself is reported.
    if (error.keyword === 'if') continue;
    const translated = translate(error, data);
    const key = `${translated.code}|${translated.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(translated);
  }
  return result;
}
