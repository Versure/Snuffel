import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { checkContent, checkScript, parseCheckArgs, repoRoot } from './check.mjs';
import { jsonErrorOffset, lineAndColumn, parseJson } from './load.mjs';
import { formatReport } from './report.mjs';
import {
  assertClean,
  assertIssue,
  fixtureRoot,
  fixtureLessonName,
  fixtureToday,
  runTool,
} from './test-helpers.mjs';

describe('content:check on the repository', () => {
  test('the fixture has no errors', () => {
    const result = checkContent({ today: fixtureToday });
    assertClean(result);
    assert.deepEqual(
      result.courses.map((course) => course.data.id),
      ['proefcursus'],
    );
  });

  test('the fixture uses every block and step type', () => {
    const [course] = checkContent({ today: fixtureToday }).courses;
    const lesson = course.lessons[0].data;
    const stepTypes = new Set(lesson.steps.map((step) => step.type));
    assert.deepEqual([...stepTypes].sort(), ['explain', 'interaction', 'practice', 'quiz']);
    const blockTypes = new Set(
      lesson.steps
        .flatMap((step) => (step.type === 'explain' ? step.blocks : []))
        .map((block) => block.type),
    );
    assert.deepEqual([...blockTypes].sort(), [
      'example',
      'figure',
      'rule',
      'signal-cards',
      'ted-says',
      'text',
      'tip',
    ]);
    const interaction = lesson.steps.find((step) => step.type === 'interaction').interaction;
    assert.equal(interaction.kind, 'trace-game');
    assert.equal(interaction.config.patterns.length, 5);
    const quiz = lesson.steps.find((step) => step.type === 'quiz');
    assert.equal(quiz.questions.length, 4);
    const practice = lesson.steps.find((step) => step.type === 'practice');
    assert.equal(practice.practiceKind, 'do-it-yourself');
    assert.ok(lesson.glossary.length > 0);
    assert.ok(lesson.furtherReading.length > 0);
    assert.ok(lesson.faq.length > 0);
    assert.match(lesson.title, /^Proefles:/);
    assert.deepEqual(
      course.data.lessons.map(({ id, status }) => [id, status]),
      [
        ['proefles', 'published'],
        ['proefles-later', 'planned'],
      ],
    );
  });

  test('without fixtures only content/courses is checked', () => {
    const result = checkContent({ fixtures: false, today: fixtureToday });
    assertClean(result);
    assert.deepEqual(result.courses, []);
  });

  test('the CLI prints "geen fouten" and exits with 0', async () => {
    const { code, stdout } = await runTool(checkScript);
    assert.equal(code, 0);
    assert.match(stdout, /content:check: geen fouten/);
  });
});

describe('content:check on a broken fixture', () => {
  test('the copied fixture is clean', (t) => {
    assertClean(fixtureRoot(t).check());
  });

  test('broken JSON gives json-invalid with line and column', (t) => {
    const fixture = fixtureRoot(t);
    fixture.writeFile(
      fixtureLessonName,
      '{\n  "schemaVersion": 1,\n  "id": "proefles"\n  "version": 1\n}\n',
    );
    const error = assertIssue(fixture.check(), 'json-invalid', '', fixture.lessonFile);
    assert.match(error.message, /regel 4, kolom 3/);
  });

  test('reports schema errors with file and path', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.steps[0].blocks[1].cards[0].titel = 'tikfout';
    });
    const result = fixture.check();
    const error = assertIssue(
      result,
      'schema',
      'steps[0].blocks[1].cards[0].titel',
      fixture.lessonFile,
    );
    assert.match(error.message, /onbekend veld "titel"/);
    const report = formatReport(result);
    assert.match(report, /^content:check: 1 fout$/m);
    assert.match(report, new RegExp(`^FOUT ${fixture.lessonFile}$`, 'm'));
    assert.match(
      report,
      /^ {2}steps\[0\]\.blocks\[1\]\.cards\[0\]\.titel: onbekend veld "titel".* \[schema\]$/m,
    );
  });

  test('exits with code 1 on errors', async (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateCourse((course) => {
      delete course.goal;
      course.sources[0].reliability = 'zeker';
    });
    const { code, stderr } = await runTool(checkScript, ['--root', fixture.root]);
    assert.equal(code, 1);
    assert.match(stderr, /content:check: 2 fouten/);
    assert.match(stderr, new RegExp(`FOUT ${fixture.courseFile}`));
    assert.match(stderr, /goal: verplicht veld "goal" ontbreekt \[schema\]/);
    assert.match(stderr, /sources\[0\]\.reliability: waarde "zeker" is niet toegestaan/);
  });

  test('a missing lesson file gives lesson-file-missing', (t) => {
    const fixture = fixtureRoot(t);
    fixture.remove(fixtureLessonName);
    assertIssue(fixture.check(), 'lesson-file-missing', 'lessons[0].file', fixture.courseFile);
  });

  test('a lesson id that differs from course.json gives lesson-id-mismatch', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.id = 'andere-les';
    });
    assertIssue(fixture.check(), 'lesson-id-mismatch', 'id', fixture.lessonFile);
  });

  test('a lesson file not in course.json gives lesson-file-orphan', (t) => {
    const fixture = fixtureRoot(t);
    fixture.writeJson('lessons/02-proefles-later.json', {
      ...fixture.readLesson(),
      id: 'proefles-later',
    });
    assertIssue(
      fixture.check(),
      'lesson-file-orphan',
      '',
      `${fixture.relCourseDir}/lessons/02-proefles-later.json`,
    );
  });

  test('a course id that differs from its directory gives course-id-mismatch', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateCourse((course) => {
      course.id = 'andere-cursus';
    });
    assertIssue(fixture.check(), 'course-id-mismatch', 'id', fixture.courseFile);
  });

  test('duplicate lesson id across courses gives id-duplicate', (t) => {
    const fixture = fixtureRoot(t);
    fixture.copyCourseTo('tweede-cursus');
    const secondCourse = `${fixture.relCourseDir.replace('proefcursus', 'tweede-cursus')}/course.json`;
    fixture.writeFile(
      '../tweede-cursus/course.json',
      JSON.stringify({ ...fixture.readCourse(), id: 'tweede-cursus' }),
    );
    const result = fixture.check();
    const error = assertIssue(result, 'id-duplicate', 'lessons[0].id', secondCourse);
    assert.match(error.message, /les-id "proefles"/);
    assert.ok(error.message.includes(fixture.courseFile), error.message);
    assertIssue(result, 'id-duplicate', 'lessons[1].id', secondCourse);
  });

  test('duplicate course id gives id-duplicate', (t) => {
    const fixture = fixtureRoot(t);
    fixture.copyCourseTo('tweede-cursus');
    const result = fixture.check();
    assertIssue(result, 'course-id-mismatch', 'id');
    assertIssue(result, 'id-duplicate', 'id');
  });

  test('duplicate question id gives id-duplicate', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.steps[2].questions[1].id = lesson.steps[2].questions[0].id;
    });
    const error = assertIssue(
      fixture.check(),
      'id-duplicate',
      'steps[2].questions[1].id',
      fixture.lessonFile,
    );
    assert.match(error.message, /steps\[2\]\.questions\[0\]\.id/);
  });

  test('a step id reused as checklist item id gives id-duplicate', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.steps[3].items[0].id = 'uitleg';
    });
    assertIssue(fixture.check(), 'id-duplicate', 'steps[3].items[0].id');
  });

  test('duplicate option id, source id and glossary term give id-duplicate', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.steps[2].questions[0].options[1].id = lesson.steps[2].questions[0].options[0].id;
      lesson.glossary.push({ term: 'Shad', definition: 'nog een keer' });
    });
    fixture.mutateCourse((course) => {
      course.sources.push({ ...course.sources[0], title: 'Kopie' });
    });
    const result = fixture.check();
    assertIssue(result, 'id-duplicate', 'steps[2].questions[0].options[1].id');
    assertIssue(
      result,
      'id-duplicate',
      `glossary[${fixture.readLesson().glossary.length - 1}].term`,
    );
    assertIssue(result, 'id-duplicate', `sources[${fixture.readCourse().sources.length - 1}].id`);
  });

  test('a trace-game answer that is not a choice gives interaction-answer-unknown', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.steps[1].interaction.config.patterns[0].answer = 'snoek';
    });
    assertIssue(
      fixture.check(),
      'interaction-answer-unknown',
      'steps[1].interaction.config.patterns[0].answer',
    );
  });

  test('the CLI counts errors in Dutch', async (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.id = 'andere-les';
    });
    const { code, stderr } = await runTool(checkScript, ['--root', fixture.root]);
    assert.equal(code, 1);
    assert.match(stderr, /^content:check: 1 fout$/m);
    assert.match(stderr, /\[lesson-id-mismatch\]/);
  });
});

describe('helpers', () => {
  test('lineAndColumn and parseJson give 1-based positions', () => {
    assert.deepEqual(lineAndColumn('ab\ncd', 4), { line: 2, column: 2 });
    const { error } = parseJson('{"a": }', 'x.json');
    assert.equal(error.code, 'json-invalid');
    assert.match(error.message, /regel 1, kolom 7/);
  });

  test('jsonErrorOffset finds the first syntax error', () => {
    for (const valid of [
      '{}',
      '[1, -2.5e3, true, false, null, "a\\u00e9"]',
      ' {"a": {"b": []}} ',
    ]) {
      assert.equal(jsonErrorOffset(valid), -1, valid);
      assert.doesNotThrow(() => JSON.parse(valid));
    }
    assert.equal(jsonErrorOffset('{"a": 1,}'), 8);
    assert.equal(jsonErrorOffset('{"a" 1}'), 5);
    assert.equal(jsonErrorOffset('[1 2]'), 3);
    assert.equal(jsonErrorOffset('{"a": "b'), 8);
    assert.equal(jsonErrorOffset('{} x'), 3);
  });

  test('parseCheckArgs reads --no-fixtures and --root', () => {
    assert.deepEqual(parseCheckArgs([]), { fixtures: true, base: undefined, root: repoRoot });
    assert.equal(parseCheckArgs(['--base', 'origin/main']).base, 'origin/main');
    assert.equal(parseCheckArgs(['--no-fixtures']).fixtures, false);
  });
});
