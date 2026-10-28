// Checks the Claude Code configuration in .claude/: agent and skill frontmatter, the agents that
// skills refer to, and that the interaction catalogue (catalogus.md, tools/content/catalog.mjs)
// matches the lesson schema. The skills and agents are instructions; this test guards their form
// and references, not how well they work.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { describe, test } from 'node:test';
import { interactionCatalog } from './content/catalog.mjs';

const repoRoot = resolve(import.meta.dirname, '..');
const agentsDir = join(repoRoot, '.claude', 'agents');
const skillsDir = join(repoRoot, '.claude', 'skills');
const schemaDir = join(repoRoot, 'content', 'schema', 'v1');

/**
 * Reads the frontmatter between the first two `---` lines: `key: value` per line, surrounding
 * quotes removed. `tools` becomes a list split on commas.
 */
export function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return undefined;
  const end = lines.indexOf('---', 1);
  if (end === -1) return undefined;
  const data = {};
  for (const line of lines.slice(1, end)) {
    const match = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    data[match[1]] = value;
  }
  if (data.tools !== undefined) {
    data.tools = data.tools
      .split(',')
      .map((tool) => tool.trim())
      .filter(Boolean);
  }
  return data;
}

export function readFrontmatter(file) {
  return parseFrontmatter(readFileSync(file, 'utf8'));
}

const agentFiles = readdirSync(agentsDir)
  .filter((name) => name.endsWith('.md'))
  .sort()
  .map((name) => join(agentsDir, name));
const agentNames = agentFiles.map((file) => basename(file, '.md'));
const skillFolders = readdirSync(skillsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const skillFile = (name) => join(skillsDir, name, 'SKILL.md');
const agent = (name) => readFrontmatter(join(agentsDir, `${name}.md`));

/** The tools of an agent are all in `allowed` and include every tool in `required`. */
function assertToolsWithin(name, allowed, required) {
  const { tools } = agent(name);
  assert.ok(Array.isArray(tools) && tools.length > 0, `${name}: tools missing`);
  for (const tool of tools) assert.ok(allowed.includes(tool), `${name}: tool ${tool} not allowed`);
  for (const tool of required) assert.ok(tools.includes(tool), `${name}: needs ${tool}`);
}

/**
 * Names in backticks that look like an agent: a known agent name, or any name ending in
 * `-researcher` or `-reviewer` (so a reference to an agent that does not exist is caught).
 */
export function agentReferences(text, knownAgents) {
  const names = new Set();
  for (const [, name] of text.matchAll(/`([a-z][a-z0-9-]*)`/g)) {
    if (knownAgents.includes(name) || /-(researcher|reviewer)$/.test(name)) names.add(name);
  }
  return [...names].sort();
}

/** The `const` values of `kind` in the interaction definitions of lesson.schema.json. */
function schemaInteractionKinds() {
  const schema = JSON.parse(readFileSync(join(schemaDir, 'lesson.schema.json'), 'utf8'));
  const kinds = new Set();
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (node === null || typeof node !== 'object') return;
    const kind = node.properties?.kind?.const;
    if (typeof kind === 'string' && node.properties.config) kinds.add(kind);
    Object.values(node).forEach(visit);
  };
  visit(schema);
  return [...kinds].sort();
}

describe('parseFrontmatter', () => {
  test('reads keys, strips quotes and splits tools', () => {
    const data = parseFrontmatter(
      "---\nname: x\ndescription: Doet iets: echt.\ntools: Read, Grep\nargument-hint: '<a> [b]'\n---\n# x\n",
    );
    assert.deepEqual(data, {
      name: 'x',
      description: 'Doet iets: echt.',
      tools: ['Read', 'Grep'],
      'argument-hint': '<a> [b]',
    });
  });

  test('no frontmatter gives undefined', () => {
    assert.equal(parseFrontmatter('# geen frontmatter\n'), undefined);
    assert.equal(parseFrontmatter('---\nname: x\n'), undefined);
  });

  test('agentReferences finds known names and unknown -researcher/-reviewer names', () => {
    const text =
      'Zet `planner` in, dan `bron-researcher` en `iets-reviewer`; niet `npm run check`.';
    assert.deepEqual(agentReferences(text, ['planner', 'tester']), [
      'bron-researcher',
      'iets-reviewer',
      'planner',
    ]);
  });
});

describe('.claude configuration', () => {
  test('every agent has a name matching its file, a description and a tools list', () => {
    assert.ok(agentFiles.length > 0);
    for (const file of agentFiles) {
      const data = readFrontmatter(file);
      assert.ok(data, `${file}: no frontmatter`);
      assert.equal(data.name, basename(file, '.md'), file);
      assert.ok(data.description?.length > 0, `${file}: description missing`);
      assert.ok(Array.isArray(data.tools) && data.tools.length > 0, `${file}: tools missing`);
    }
  });

  test('every skill has a name matching its folder and a description', () => {
    assert.ok(skillFolders.length > 0);
    for (const folder of skillFolders) {
      const file = skillFile(folder);
      assert.ok(existsSync(file), `${folder}: SKILL.md missing`);
      const data = readFrontmatter(file);
      assert.ok(data, `${file}: no frontmatter`);
      assert.equal(data.name, folder, file);
      assert.ok(data.description?.length > 0, `${file}: description missing`);
    }
  });

  test('every agent named in a skill exists in .claude/agents', () => {
    for (const folder of skillFolders) {
      const text = readFileSync(skillFile(folder), 'utf8');
      for (const name of agentReferences(text, agentNames)) {
        assert.ok(agentNames.includes(name), `${folder}: agent ${name} does not exist`);
      }
    }
  });

  test('every interaction kind in lesson.schema.json has a section in catalogus.md', () => {
    const kinds = schemaInteractionKinds();
    assert.ok(kinds.length > 0);
    const catalogue = readFileSync(join(schemaDir, 'catalogus.md'), 'utf8');
    const sections = [...catalogue.matchAll(/^### `([a-z0-9-]+)`/gm)].map(([, kind]) => kind);
    assert.deepEqual([...sections].sort(), kinds);
  });

  test('the interaction catalogue in tools/content/catalog.mjs lists exactly the schema kinds', () => {
    assert.deepEqual(Object.keys(interactionCatalog).sort(), schemaInteractionKinds());
  });
});

describe('content agents', () => {
  test('source-researcher can only read and use the web', () => {
    assertToolsWithin(
      'source-researcher',
      ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
      ['WebFetch', 'WebSearch'],
    );
  });

  test('source-researcher reads homework photos and rates a method as medium', () => {
    const text = readFileSync(join(agentsDir, 'source-researcher.md'), 'utf8');
    for (const needle of ['huiswerk-fotos/', 'type: "method"', 'reliability: "medium"']) {
      assert.ok(text.includes(needle), `source-researcher does not mention ${needle}`);
    }
  });

  test('content-reviewer can only read and open sources', () => {
    assertToolsWithin('content-reviewer', ['Read', 'Glob', 'Grep', 'WebFetch'], ['WebFetch']);
    const { tools } = agent('content-reviewer');
    for (const tool of ['Write', 'Edit', 'Bash', 'WebSearch']) {
      assert.ok(!tools.includes(tool), `content-reviewer must not have ${tool}`);
    }
  });

  test('content-reviewer checks lessons against homework photos', () => {
    const text = readFileSync(join(agentsDir, 'content-reviewer.md'), 'utf8');
    for (const needle of ['huiswerk-fotos/', "foto's", 'notatie', 'persoonsgegevens']) {
      assert.ok(text.includes(needle), `content-reviewer does not mention ${needle}`);
    }
  });

  test('snuffel-leren names source-researcher and content-reviewer, and both agent files exist', () => {
    const text = readFileSync(skillFile('snuffel-leren'), 'utf8');
    const named = agentReferences(text, agentNames);
    for (const name of ['source-researcher', 'content-reviewer']) {
      assert.ok(named.includes(name), `snuffel-leren does not name ${name}`);
      assert.ok(existsSync(join(agentsDir, `${name}.md`)), `.claude/agents/${name}.md missing`);
    }
  });

  test('snuffel-leren asks for homework photos in huiswerk-fotos/ and names the method source', () => {
    const text = readFileSync(skillFile('snuffel-leren'), 'utf8');
    for (const needle of ['huiswerk-fotos/', "foto's", 'type: "method"', 'reliability: "medium"']) {
      assert.ok(text.includes(needle), `snuffel-leren does not mention ${needle}`);
    }
  });

  test('snuffel-leren tells Jop that photos are sent to Anthropic', () => {
    const text = readFileSync(skillFile('snuffel-leren'), 'utf8');
    assert.ok(
      text.includes('Claude stuurt ze wel naar Anthropic'),
      'snuffel-leren does not say that photos are sent to Anthropic',
    );
  });

  test('snuffel-leren handles dragged photos that content-reviewer cannot see', () => {
    const text = readFileSync(skillFile('snuffel-leren'), 'utf8');
    for (const needle of ["Gesleepte foto's", "de reviewer de foto's niet gezien heeft"]) {
      assert.ok(text.includes(needle), `snuffel-leren does not mention ${needle}`);
    }
  });

  test('snuffel-leren names its agents, the catalogue, content:check and the content branch', () => {
    const text = readFileSync(skillFile('snuffel-leren'), 'utf8');
    for (const needle of [
      '`source-researcher`',
      '`content-reviewer`',
      'content/schema/v1/catalogus.md',
      'npm run content:check',
      'content/<cursus-id>-<les-id>',
      '--voorbeeld',
    ]) {
      assert.ok(text.includes(needle), `snuffel-leren does not mention ${needle}`);
    }
  });

  test('snuffel-leren plans, draws and looks at figures in every lesson', () => {
    const text = readFileSync(skillFile('snuffel-leren'), 'utf8');
    for (const needle of [
      'content/illustrations/README.md',
      'content/illustrations/templates/',
      'beeldlijst',
      'npm run content:figures',
      'tmp/figures/',
    ]) {
      assert.ok(text.includes(needle), `snuffel-leren does not mention ${needle}`);
    }
    assert.ok(
      !text.includes('alleen als een afbeelding iets uitlegt'),
      'snuffel-leren still limits figures to "alleen als"',
    );
  });

  test('content-reviewer reviews figures and blocks spatial explanations in text only', () => {
    const text = readFileSync(join(agentsDir, 'content-reviewer.md'), 'utf8');
    for (const needle of [
      'content/illustrations/README.md',
      'beeldlijst',
      'content:figures',
      'tmp/figures/',
      '**Visueel**',
      'plek, vorm, volgorde, vergelijking of beweging',
    ]) {
      assert.ok(text.includes(needle), `content-reviewer does not mention ${needle}`);
    }
  });
});
