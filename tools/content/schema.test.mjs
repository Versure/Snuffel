import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { compileSchemas, loadSchema, pointerToPath, schemaKinds, validate } from './schema.mjs';

const clone = (value) => structuredClone(value);

const source = {
  id: 'svnl-roofvis',
  title: 'Roofvissen',
  url: 'https://www.sportvisserijnederland.nl/files/rvnl_9303.pdf',
  publisher: 'Sportvisserij Nederland',
  type: 'association',
  reliability: 'high',
  accessedOn: '2026-10-19',
};

const minimalCourse = {
  schemaVersion: 1,
  id: 'roofvissen',
  title: 'Roofvissen met kunstaas',
  audience: 'Ouder en kind',
  goal: 'Zelf een roofvis vangen',
  successCriterion: 'Een roofvis vangen en terugzetten',
  kind: 'course',
  ted: { greeting: 'Klaar om te snuffelen?' },
  lessons: [
    { id: 'aanbeet', title: 'Aanbeet', status: 'published', file: 'lessons/01-aanbeet.json' },
    { id: 'later', title: 'Later', status: 'planned' },
  ],
  sources: [source],
};

const option = (id) => ({ id, text: `Optie ${id}`, feedback: `Uitleg bij ${id}` });

const minimalLesson = {
  schemaVersion: 1,
  id: 'aanbeet',
  version: 1,
  title: 'Aanbeet of vastzitten?',
  sticker: 'Roofvissen · les 1',
  objective: 'Je herkent een aanbeet.',
  concept: 'aanbeet herkennen',
  estimatedMinutes: 10,
  glossary: [],
  ted: {
    intro: { mood: 'cool', text: 'Yo! Ik ben Ted.' },
    correct: ['Goed!'],
    incorrect: ['Bijna.'],
    finished: 'Klaar!',
  },
  steps: [
    {
      id: 'uitleg',
      type: 'explain',
      title: 'Uitleg',
      blocks: [
        { type: 'text', text: 'Tekst.', sourceRefs: [] },
        { type: 'figure', src: 'assets/top.svg', alt: 'Een hengeltop', sourceRefs: [] },
      ],
    },
    {
      id: 'quiz',
      type: 'quiz',
      title: 'Quiz',
      questions: [
        {
          id: 'vraag-1',
          prompt: 'Wat doe je?',
          options: [option('a'), option('b'), option('c')],
          correctOptionId: 'a',
          hints: [],
          sourceRefs: ['svnl-roofvis'],
        },
      ],
    },
  ],
  furtherReading: [],
  faq: [],
};

const traceGame = {
  id: 'voel-spel',
  kind: 'trace-game',
  config: {
    choices: [
      { id: 'vis', label: 'Vis!', color: 'yellow' },
      { id: 'vast', label: 'Vast', color: 'purple' },
    ],
    patterns: [
      {
        id: 'tik',
        answer: 'vis',
        shape: [
          { type: 'base', level: 0.22 },
          { type: 'pulse', at: 0.5, width: 0.012, height: 0.62 },
          { type: 'wobble', amplitude: 0.015, frequency: 6 },
        ],
        explanation: 'Een tik.',
      },
      {
        id: 'vast',
        answer: 'vast',
        shape: [
          { type: 'base', level: 0.22 },
          { type: 'ramp', from: 0.32, to: 0.42, height: 0.63 },
          { type: 'pulses', start: 0.08, interval: 0.13, count: 8, width: 0.01, height: 0.22 },
          { type: 'wobble', amplitude: 0.1, frequency: 9, from: 0.3, to: 1 },
        ],
        explanation: 'Vast.',
      },
    ],
    rounds: 8,
    durationMs: 3200,
  },
};

const steppedExercise = {
  id: 'breuken',
  kind: 'stepped-exercise',
  config: {
    exercises: [
      {
        id: 'som-1',
        prompt: 'Hoeveel is 1/2 + 1/4?',
        answer: { type: 'number', value: 0.75, tolerance: 0.001 },
        hints: ['Maak de noemers gelijk.'],
        steps: [{ id: 'noemers', title: 'Noemers', text: '1/2 = 2/4' }],
        commonMistakes: [{ answer: '2/6', feedback: 'Tellers en noemers tel je niet los op.' }],
        workedSolution: '1/2 = 2/4, en 2/4 + 1/4 = 3/4.',
      },
      {
        id: 'som-2',
        prompt: 'Welk woord?',
        answer: { type: 'text', accepted: ['drie kwart', '3/4'] },
        hints: [],
        steps: [],
        commonMistakes: [],
        workedSolution: 'Drie kwart.',
      },
      {
        id: 'som-3',
        prompt: 'Welke is groter?',
        answer: {
          type: 'choice',
          options: [
            { id: 'half', text: '1/2' },
            { id: 'derde', text: '1/3' },
          ],
          correctOptionId: 'half',
        },
        hints: [],
        steps: [],
        commonMistakes: [],
        workedSolution: 'Een half is groter.',
      },
    ],
  },
};

function lessonWithInteraction(interaction) {
  const lesson = clone(minimalLesson);
  lesson.steps.splice(1, 0, {
    id: 'spel',
    type: 'interaction',
    title: 'Spel',
    intro: 'Speel mee.',
    interaction,
    sourceRefs: [],
  });
  return lesson;
}

/** Asserts exactly one error at `path` with a Dutch message (and optionally a code). */
function assertError(errors, path, code = 'schema') {
  const match = errors.filter((error) => error.path === path);
  assert.equal(match.length, 1, `expected one error at ${path}, got ${JSON.stringify(errors)}`);
  assert.equal(match[0].code, code);
  // Dutch, not the ajv English ("must have required property …").
  assert.doesNotMatch(match[0].message, /\bmust\b/);
  return match[0];
}

describe('schemas', () => {
  test('all schemas compile in strict mode', () => {
    const validators = compileSchemas();
    assert.deepEqual(Object.keys(validators), schemaKinds);
    for (const kind of schemaKinds) {
      const schema = loadSchema(kind);
      assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
      assert.equal(schema.$id, `urn:snuffel:content:v1:${kind}`);
    }
  });

  test('accepts a minimal course and lesson', () => {
    assert.deepEqual(validate('course', minimalCourse), []);
    assert.deepEqual(validate('lesson', minimalLesson), []);
  });

  test('accepts a practice course', () => {
    const course = {
      ...clone(minimalCourse),
      kind: 'practice',
      subject: 'Rekenen',
      schoolLevel: 'Groep 7',
      method: 'Pluspunt',
      chapter: 'Blok 3: breuken',
    };
    assert.deepEqual(validate('course', course), []);
  });

  test('accepts a trace-game', () => {
    assert.deepEqual(validate('lesson', lessonWithInteraction(traceGame)), []);
  });

  test('a wobble accepts phase and fadeIn', () => {
    const game = clone(traceGame);
    game.config.patterns[1].shape.push({
      type: 'wobble',
      amplitude: 0.085,
      frequency: 6.6845,
      phase: 0.0908,
      from: 0.32,
      fadeIn: 0.08,
    });
    assert.deepEqual(validate('lesson', lessonWithInteraction(game)), []);
  });

  test('a wobble with phase 1.5 or fadeIn -0.1 is a schema error', () => {
    for (const [field, value] of [
      ['phase', 1.5],
      ['fadeIn', -0.1],
    ]) {
      const game = clone(traceGame);
      game.config.patterns[0].shape[2][field] = value;
      const errors = validate('lesson', lessonWithInteraction(game));
      assertError(errors, `steps[1].interaction.config.patterns[0].shape[2].${field}`);
    }
  });

  test('accepts a stepped-exercise', () => {
    assert.deepEqual(validate('lesson', lessonWithInteraction(steppedExercise)), []);
  });

  test('a stepped-exercise with 11 exercises is a schema error', () => {
    const exercise = steppedExercise.config.exercises[0];
    const ten = clone(steppedExercise);
    ten.config.exercises = Array.from({ length: 10 }, (_, index) => ({
      ...clone(exercise),
      id: `som-${index + 1}`,
    }));
    assert.deepEqual(validate('lesson', lessonWithInteraction(ten)), []);

    const eleven = clone(ten);
    eleven.config.exercises.push({ ...clone(exercise), id: 'som-11' });
    assertError(
      validate('lesson', lessonWithInteraction(eleven)),
      'steps[1].interaction.config.exercises',
    );
  });

  test('accepts a manifest and a terms list', () => {
    const manifest = {
      schemaVersion: 1,
      courses: [
        {
          id: 'roofvissen',
          title: 'Roofvissen',
          kind: 'course',
          file: 'roofvissen/course.json',
          hash: '0123456789abcdef',
          lessons: [
            {
              id: 'aanbeet',
              title: 'Aanbeet',
              status: 'published',
              version: 1,
              estimatedMinutes: 10,
              file: 'roofvissen/lessons/aanbeet.json',
              hash: 'fedcba9876543210',
              stepIds: ['uitleg', 'quiz'],
            },
            { id: 'later', title: 'Later', status: 'planned' },
          ],
          assets: [{ path: 'assets/top.svg', hash: '00112233445566aa' }],
        },
      ],
    };
    assert.deepEqual(validate('manifest', manifest), []);
    const planned = clone(manifest);
    planned.courses[0].lessons[1].hash = '0123456789abcdef';
    assertError(validate('manifest', planned), 'courses[0].lessons[1].hash');
    const withoutAssets = clone(manifest);
    delete withoutAssets.courses[0].assets;
    assertError(validate('manifest', withoutAssets), 'courses[0].assets');
    const outsideAssets = clone(manifest);
    outsideAssets.courses[0].assets[0].path = '../geheim.svg';
    assertError(
      validate('manifest', outsideAssets),
      'courses[0].assets[0].path',
      'asset-path-invalid',
    );
    assert.deepEqual(
      validate('terms', { schemaVersion: 1, terms: [{ term: 'aanslaan', forms: ['slaat aan'] }] }),
      [],
    );
  });

  test('a published manifest lesson without stepIds is a schema error', () => {
    const manifest = {
      schemaVersion: 1,
      courses: [
        {
          id: 'roofvissen',
          title: 'Roofvissen',
          kind: 'course',
          file: 'roofvissen/course.json',
          hash: '0123456789abcdef',
          lessons: [
            {
              id: 'aanbeet',
              title: 'Aanbeet',
              status: 'published',
              version: 1,
              estimatedMinutes: 10,
              file: 'roofvissen/lessons/aanbeet.json',
              hash: 'fedcba9876543210',
              stepIds: ['uitleg'],
            },
            { id: 'later', title: 'Later', status: 'planned' },
          ],
          assets: [],
        },
      ],
    };
    assert.deepEqual(validate('manifest', manifest), []);
    const without = clone(manifest);
    delete without.courses[0].lessons[0].stepIds;
    assertError(validate('manifest', without), 'courses[0].lessons[0].stepIds');
    const empty = clone(manifest);
    empty.courses[0].lessons[0].stepIds = [];
    assertError(validate('manifest', empty), 'courses[0].lessons[0].stepIds');
    const twice = clone(manifest);
    twice.courses[0].lessons[0].stepIds = ['uitleg', 'uitleg'];
    assertError(validate('manifest', twice), 'courses[0].lessons[0].stepIds');
    const planned = clone(manifest);
    planned.courses[0].lessons[1].stepIds = ['uitleg'];
    assertError(validate('manifest', planned), 'courses[0].lessons[1].stepIds');
  });

  test('rejects an unknown key with a Dutch message', () => {
    const lesson = clone(minimalLesson);
    lesson.steps[0].blocks[0].txet = 'tikfout';
    const error = assertError(validate('lesson', lesson), 'steps[0].blocks[0].txet');
    assert.match(error.message, /onbekend veld "txet"/);
  });

  test('rejects a missing required field with a Dutch message', () => {
    const lesson = clone(minimalLesson);
    delete lesson.objective;
    const error = assertError(validate('lesson', lesson), 'objective');
    assert.match(error.message, /verplicht veld "objective" ontbreekt/);
  });

  test('rejects a non-kebab-case id', () => {
    const lesson = clone(minimalLesson);
    lesson.id = 'Proef_Les';
    const error = assertError(validate('lesson', lesson), 'id');
    assert.match(error.message, /ongeldig id "Proef_Les"/);
    const course = clone(minimalCourse);
    course.lessons[0].id = 'Proef_Les';
    assertError(validate('course', course), 'lessons[0].id');
  });

  test('rejects schemaVersion 2 with a Dutch message', () => {
    for (const [kind, data] of [
      ['course', minimalCourse],
      ['lesson', minimalLesson],
    ]) {
      const changed = { ...clone(data), schemaVersion: 2 };
      const error = assertError(validate(kind, changed), 'schemaVersion');
      assert.match(error.message, /moet 1 zijn/);
    }
  });

  test('rejects a practice course without subject with a Dutch message', () => {
    const course = {
      ...clone(minimalCourse),
      kind: 'practice',
      schoolLevel: 'Groep 7',
      method: 'Pluspunt',
      chapter: 'Blok 3',
    };
    const error = assertError(validate('course', course), 'subject');
    assert.match(error.message, /verplicht veld "subject"/);
  });

  test('rejects a published lesson without file with a Dutch message', () => {
    const course = clone(minimalCourse);
    delete course.lessons[0].file;
    assertError(validate('course', course), 'lessons[0].file');
    const planned = clone(minimalCourse);
    planned.lessons[1].file = 'lessons/02-later.json';
    const error = assertError(validate('course', planned), 'lessons[1].file');
    assert.match(error.message, /mag hier niet staan/);
  });

  test('rejects a source without reliability with a Dutch message', () => {
    const course = clone(minimalCourse);
    delete course.sources[0].reliability;
    const error = assertError(validate('course', course), 'sources[0].reliability');
    assert.match(error.message, /verplicht veld "reliability"/);
  });

  test('rejects a source without accessedOn with a Dutch message', () => {
    const course = clone(minimalCourse);
    delete course.sources[0].accessedOn;
    assertError(validate('course', course), 'sources[0].accessedOn');
    course.sources[0].accessedOn = '19-10-2026';
    const error = assertError(validate('course', course), 'sources[0].accessedOn');
    assert.match(error.message, /JJJJ-MM-DD/);
  });

  test('rejects an http source with link-not-https', () => {
    const course = clone(minimalCourse);
    course.sources[0].url = 'http://www.sportvisserijnederland.nl/';
    assertError(validate('course', course), 'sources[0].url', 'link-not-https');
  });

  test('rejects a figure without alt with a Dutch message', () => {
    const lesson = clone(minimalLesson);
    delete lesson.steps[0].blocks[1].alt;
    const error = assertError(validate('lesson', lesson), 'steps[0].blocks[1].alt');
    assert.match(error.message, /verplicht veld "alt"/);
    lesson.steps[0].blocks[1].alt = '   ';
    assertError(validate('lesson', lesson), 'steps[0].blocks[1].alt', 'figure-alt-missing');
  });

  test('rejects an option without feedback with a Dutch message', () => {
    const lesson = clone(minimalLesson);
    delete lesson.steps[1].questions[0].options[2].feedback;
    const error = assertError(
      validate('lesson', lesson),
      'steps[1].questions[0].options[2].feedback',
    );
    assert.match(error.message, /verplicht veld "feedback"/);
    lesson.steps[1].questions[0].options[2].feedback = '  ';
    const blank = assertError(
      validate('lesson', lesson),
      'steps[1].questions[0].options[2].feedback',
    );
    assert.match(blank.message, /mag niet leeg zijn/);
  });

  test('rejects an unknown block type and a colour value instead of a token name', () => {
    const lesson = clone(minimalLesson);
    lesson.steps[0].blocks[0].type = 'video';
    const error = assertError(validate('lesson', lesson), 'steps[0].blocks[0].type');
    assert.match(error.message, /onbekende soort "video"/);
    const game = lessonWithInteraction(clone(traceGame));
    game.steps[1].interaction.config.choices[0].color = '#ffd83d';
    assertError(validate('lesson', game), 'steps[1].interaction.config.choices[0].color');
  });

  const signalIcons = ['tick', 'shake', 'stop', 'check', 'cross', 'question', 'idea', 'warning'];

  function lessonWithIcons(icons) {
    const lesson = clone(minimalLesson);
    lesson.steps[0].blocks.push({
      type: 'signal-cards',
      cards: icons.map((icon) => ({ icon, title: 'Kaart', text: 'Tekst.', sourceRefs: [] })),
    });
    return lesson;
  }

  test('accepts every signal icon from the set', () => {
    assert.deepEqual(validate('lesson', lessonWithIcons(signalIcons)), []);
    assert.deepEqual(loadSchema('lesson').$defs.signalIcon.enum, signalIcons);
  });

  test('rejects an unknown signal-card icon with a Dutch message', () => {
    const error = assertError(
      validate('lesson', lessonWithIcons(['fish'])),
      'steps[0].blocks[2].cards[0].icon',
    );
    assert.match(error.message, /waarde "fish" is niet toegestaan/);
    assert.match(error.message, new RegExp(`kies uit: ${signalIcons.join(', ')}`));
  });

  test('pointerToPath writes array indexes in brackets', () => {
    assert.equal(pointerToPath(''), '');
    assert.equal(pointerToPath('', 'id'), 'id');
    assert.equal(pointerToPath('/steps/0/blocks/1'), 'steps[0].blocks[1]');
    assert.equal(pointerToPath('/a~1b', 'c'), 'a/b.c');
  });
});
