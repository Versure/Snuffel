import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { checkScript } from './check.mjs';
import { canonical, resolveBase } from './rules/stability.mjs';
import { assertClean, assertIssue, fixtureRoot, runTool } from './test-helpers.mjs';

/** Runs git in a temporary repository, without GIT_* variables from a surrounding hook. */
function git(root, ...args) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
  );
  return execFileSync('git', args, { cwd: root, env, encoding: 'utf8', stdio: 'pipe' });
}

/**
 * A temporary git repository with the fixture course as published content
 * (content/courses/proefcursus), committed on main. `place: 'fixtures'` commits it as a fixture.
 */
function publishedRepo(t, { place = 'courses', branch = 'main' } = {}) {
  const fixture = fixtureRoot(t, { place });
  git(fixture.root, 'init', '--quiet', '--initial-branch', branch);
  git(fixture.root, 'config', 'user.name', 'Test');
  git(fixture.root, 'config', 'user.email', 'test@example.invalid');
  git(fixture.root, 'config', 'commit.gpgsign', 'false');
  git(fixture.root, 'add', '.');
  git(fixture.root, 'commit', '--quiet', '--no-verify', '-m', 'published');
  return fixture;
}

const quiz = (lesson) => lesson.steps[2];

describe('id stability against main', () => {
  test('nothing changed is fine', (t) => {
    const fixture = publishedRepo(t);
    const result = fixture.check();
    assertClean(result);
    assert.deepEqual(result.warnings, []);
  });

  test('changed text with version bump is fine', (t) => {
    const fixture = publishedRepo(t);
    fixture.mutateLesson((lesson) => {
      lesson.version = 2;
      lesson.faq[0].a = 'Sla aan. Het kost je niets.';
    });
    assertClean(fixture.check());
  });

  test('changed text without version bump gives version-not-bumped', (t) => {
    const fixture = publishedRepo(t);
    fixture.mutateLesson((lesson) => {
      lesson.faq[0].a = 'Sla aan. Het kost je niets.';
    });
    const error = assertIssue(fixture.check(), 'version-not-bumped', 'version', fixture.lessonFile);
    assert.match(error.message, /verhoog version naar 2/);
  });

  test('a lower version than on main gives version-not-bumped', (t) => {
    const fixture = publishedRepo(t);
    fixture.mutateLesson((lesson) => {
      lesson.version = 2;
    });
    git(fixture.root, 'commit', '--quiet', '--no-verify', '-am', 'version 2');
    fixture.mutateLesson((lesson) => {
      lesson.version = 1;
    });
    assertIssue(fixture.check(), 'version-not-bumped', 'version');
  });

  test('only a different key order is not a change', (t) => {
    const fixture = publishedRepo(t);
    fixture.mutateLesson((lesson) => {
      const { faq, ...rest } = lesson;
      return { faq, ...rest };
    });
    assertClean(fixture.check());
    assert.equal(
      canonical({ b: 1, a: [{ d: 2, c: 3 }] }),
      canonical({ a: [{ c: 3, d: 2 }], b: 1 }),
    );
  });

  test('renamed question id gives id-removed', (t) => {
    const fixture = publishedRepo(t);
    fixture.mutateLesson((lesson) => {
      lesson.version = 2;
      quiz(lesson).questions[1].id = 'dood-gewicht-nieuw';
    });
    const error = assertIssue(
      fixture.check(),
      'id-removed',
      'steps[2].questions[1].id',
      fixture.lessonFile,
    );
    assert.match(error.message, /vraag "dood-gewicht"/);
  });

  test('option moved to another question gives id-moved', (t) => {
    const fixture = publishedRepo(t);
    fixture.mutateLesson((lesson) => {
      lesson.version = 2;
      const [first, second] = quiz(lesson).questions;
      const moved = first.options.splice(1, 1)[0];
      second.options.splice(3, 1, moved);
    });
    const error = assertIssue(fixture.check(), 'id-moved', 'steps[2].questions[1].options[3].id');
    assert.match(error.message, /optie "wachten" hoorde op main bij "schokken-terug"/);
  });

  test('a step id reused for something else gives id-moved', (t) => {
    const fixture = publishedRepo(t);
    fixture.mutateLesson((lesson) => {
      lesson.version = 2;
      lesson.steps[0].id = 'uitleg-nieuw';
      quiz(lesson).questions[0].id = 'uitleg';
    });
    const result = fixture.check();
    assertIssue(result, 'id-moved', 'steps[2].questions[0].id');
    assertIssue(result, 'id-removed', 'steps[2].questions[0].id');
  });

  test('removed step gives id-removed', (t) => {
    const fixture = publishedRepo(t);
    fixture.mutateLesson((lesson) => {
      lesson.version = 2;
      lesson.steps = lesson.steps.filter((step) => step.id !== 'zelf-doen');
    });
    const result = fixture.check();
    assertIssue(result, 'id-removed', 'steps[3].id');
    // Its checklist items are gone as well.
    assertIssue(result, 'id-removed', 'steps[3].items[0].id');
  });

  test('removed lesson gives id-removed', (t) => {
    const fixture = publishedRepo(t);
    fixture.remove('lessons/01-proefles.json');
    fixture.mutateCourse((course) => {
      course.lessons = course.lessons.filter((entry) => entry.id !== 'proefles');
    });
    const error = assertIssue(fixture.check(), 'id-removed', 'lessons', fixture.courseFile);
    assert.match(error.message, /les "proefles"/);
  });

  test('removed course gives id-removed', (t) => {
    const fixture = publishedRepo(t);
    git(fixture.root, 'rm', '--quiet', '-r', 'content/courses/proefcursus');
    const error = assertIssue(fixture.check(), 'id-removed', 'id', fixture.courseFile);
    assert.match(error.message, /cursus "proefcursus"/);
  });

  test('renamed interaction id gives id-removed', (t) => {
    const fixture = publishedRepo(t);
    fixture.mutateLesson((lesson) => {
      lesson.version = 2;
      lesson.steps[1].interaction.id = 'voel-spel-nieuw';
    });
    const error = assertIssue(
      fixture.check(),
      'id-removed',
      'steps[1].interaction.id',
      fixture.lessonFile,
    );
    assert.match(error.message, /voel-spel/);
  });

  test('renamed checklist item id gives id-removed', (t) => {
    const fixture = publishedRepo(t);
    fixture.mutateLesson((lesson) => {
      lesson.version = 2;
      lesson.steps[3].items[1].id = 'staal-en-tang-nieuw';
    });
    assertIssue(fixture.check(), 'id-removed', 'steps[3].items[1].id', fixture.lessonFile);
  });

  test('a lesson moved to another course gives id-moved', (t) => {
    const fixture = publishedRepo(t);
    const otherDir = fixture.copyCourseTo('andere-cursus');
    const otherFile = join(otherDir, 'course.json');
    const other = JSON.parse(readFileSync(otherFile, 'utf8'));
    other.id = 'andere-cursus';
    other.lessons = other.lessons.filter((entry) => entry.id === 'proefles');
    writeFileSync(otherFile, `${JSON.stringify(other, null, 2)}\n`);
    fixture.remove('lessons/01-proefles.json');
    fixture.mutateCourse((course) => {
      course.lessons = course.lessons.filter((entry) => entry.id !== 'proefles');
    });
    const error = assertIssue(
      fixture.check(),
      'id-moved',
      'lessons[0].id',
      'content/courses/andere-cursus/course.json',
    );
    assert.match(error.message, /les "proefles"/);
  });

  test('a fixture course with the same id does not replace a published course', (t) => {
    const fixture = publishedRepo(t);
    const { root } = fixture;
    // The published course disappears from content/courses; a copy lives on as a fixture.
    const shadow = join(root, 'content', 'fixtures', 'courses', 'proefcursus');
    mkdirSync(join(root, 'content', 'fixtures', 'courses'), { recursive: true });
    cpSync(fixture.courseDir, shadow, { recursive: true });
    git(root, 'rm', '--quiet', '-r', 'content/courses/proefcursus');
    assertIssue(fixture.check(), 'id-removed', 'id');
  });

  test('lesson back to planned gives lesson-unpublished', (t) => {
    const fixture = publishedRepo(t);
    fixture.remove('lessons/01-proefles.json');
    fixture.mutateCourse((course) => {
      course.lessons[0].status = 'planned';
      delete course.lessons[0].file;
    });
    assertIssue(fixture.check(), 'lesson-unpublished', 'lessons[0].status', fixture.courseFile);
  });

  test('new lesson and new question are fine', (t) => {
    const fixture = publishedRepo(t);
    fixture.mutateLesson((lesson) => {
      lesson.version = 2;
      const copy = structuredClone(quiz(lesson).questions[0]);
      copy.id = 'nieuwe-vraag';
      quiz(lesson).questions.push(copy);
      // Make room for the extra minute of the new question.
      lesson.steps[0].blocks[0].text = 'Je draait een [[shad]] binnen. Ineens wordt het zwaar.';
      lesson.steps[0].blocks[2].text = '**En vastzitten?** Dat voelt als dood gewicht.';
    });
    fixture.writeJson('lessons/03-nieuwe-les.json', { ...fixture.readLesson(), id: 'nieuwe-les' });
    fixture.mutateCourse((course) => {
      course.lessons.push({
        id: 'nieuwe-les',
        title: 'Proefles: nieuw',
        status: 'published',
        file: 'lessons/03-nieuwe-les.json',
      });
    });
    assertClean(fixture.check());
  });

  test('a lesson that was planned on main may change freely', (t) => {
    const fixture = publishedRepo(t);
    fixture.writeJson('lessons/02-proefles-later.json', {
      ...fixture.readLesson(),
      id: 'proefles-later',
    });
    fixture.mutateCourse((course) => {
      course.lessons[1].file = 'lessons/02-proefles-later.json';
      course.lessons[1].status = 'published';
    });
    git(fixture.root, 'add', '.');
    git(fixture.root, 'commit', '--quiet', '--no-verify', '-m', 'publish later lesson');
    // Only the commit above is on a branch; main still has the lesson as planned.
    git(fixture.root, 'checkout', '--quiet', '-b', 'work');
    git(fixture.root, 'branch', '--quiet', '-f', 'main', 'HEAD~1');
    fixture.writeJson('lessons/02-proefles-later.json', {
      ...fixture.readLesson(),
      id: 'proefles-later',
      steps: fixture.readLesson().steps.filter((step) => step.id !== 'zelf-doen'),
    });
    assertClean(fixture.check());
  });

  test('fixtures changed without version are fine (they fall outside the check)', (t) => {
    const fixture = publishedRepo(t, { place: 'fixtures' });
    fixture.mutateLesson((lesson) => {
      lesson.faq[0].a = 'Sla aan. Het kost je niets.';
      quiz(lesson).questions[1].id = 'dood-gewicht-nieuw';
    });
    const result = fixture.check();
    assertClean(result);
    assert.deepEqual(result.warnings, []);
  });

  test('falls back to origin/main when there is no main', (t) => {
    const fixture = publishedRepo(t, { branch: 'werk' });
    git(fixture.root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    assert.deepEqual(resolveBase(fixture.root), { ref: 'origin/main' });
    fixture.mutateLesson((lesson) => {
      lesson.faq[0].a = 'Sla aan. Het kost je niets.';
    });
    assertIssue(fixture.check(), 'version-not-bumped', 'version');
  });

  test('--base compares with another ref; an unknown ref is an error', async (t) => {
    const fixture = publishedRepo(t);
    git(fixture.root, 'tag', 'v1');
    fixture.mutateLesson((lesson) => {
      lesson.faq[0].a = 'Sla aan. Het kost je niets.';
    });
    git(fixture.root, 'commit', '--quiet', '--no-verify', '-am', 'change without version');
    assertClean(fixture.check());
    assertIssue(fixture.check({ base: 'v1' }), 'version-not-bumped', 'version');
    assertIssue(fixture.check({ base: 'bestaat-niet' }), 'base-not-found');
    const { code, stderr } = await runTool(checkScript, ['--root', fixture.root, '--base', 'v1']);
    assert.equal(code, 1);
    assert.match(stderr, /\[version-not-bumped\]/);
  });

  test('no main ref warns and passes', async (t) => {
    const fixture = publishedRepo(t, { branch: 'werk' });
    const result = fixture.check();
    assertClean(result);
    assert.deepEqual(result.warnings, [
      'id-stabiliteit niet gecontroleerd: geen main gevonden (ook geen origin/main)',
    ]);
    const { code, stdout } = await runTool(checkScript, ['--root', fixture.root]);
    assert.equal(code, 0);
    assert.match(stdout, /LET OP: id-stabiliteit niet gecontroleerd: geen main gevonden/);
    assert.match(stdout, /content:check: geen fouten/);
  });
});
