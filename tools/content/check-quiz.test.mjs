import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { optionLength } from './rules/quiz.mjs';
import { assertClean, assertIssue, assertNoIssue, fixtureRoot } from './test-helpers.mjs';

// In the fixture, steps[2] is the quiz step with 4 questions of 4 options each.
const quiz = (lesson) => lesson.steps[2];

function questionCopy(question, id) {
  return { ...structuredClone(question), id };
}

/** Options with texts of the given lengths (in characters). */
function optionsOfLength(...lengths) {
  return lengths.map((length, index) => ({
    id: `optie-${index}`,
    text: 'abcdefghijklmnopqrstuvwxyz'.slice(0, length),
    feedback: 'Uitleg.',
  }));
}

describe('quiz: number of questions', () => {
  test('2 questions gives quiz-question-count', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      quiz(lesson).questions = quiz(lesson).questions.slice(0, 2);
    });
    const error = assertIssue(fixture.check(), 'quiz-question-count', 'steps[2].questions');
    assert.match(error.message, /3 tot 5 vragen, deze heeft er 2/);
  });

  test('6 questions gives quiz-question-count', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      const [first, second] = quiz(lesson).questions;
      quiz(lesson).questions.push(questionCopy(first, 'extra-1'), questionCopy(second, 'extra-2'));
    });
    assertIssue(fixture.check(), 'quiz-question-count', 'steps[2].questions');
  });

  test('3 and 5 questions are fine', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      quiz(lesson).questions.push(questionCopy(quiz(lesson).questions[0], 'extra-1'));
    });
    assertNoIssue(fixture.check(), 'quiz-question-count');
    fixture.mutateLesson((lesson) => {
      quiz(lesson).questions = quiz(lesson).questions.slice(0, 3);
    });
    assertNoIssue(fixture.check(), 'quiz-question-count');
  });
});

describe('quiz: number of options', () => {
  test('2 options gives quiz-option-count', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      quiz(lesson).questions[0].options = quiz(lesson).questions[0].options.slice(0, 2);
    });
    assertIssue(fixture.check(), 'quiz-option-count', 'steps[2].questions[0].options');
  });

  test('5 options gives quiz-option-count', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      const options = quiz(lesson).questions[0].options;
      options.push({ ...options[3], id: 'vijfde' });
    });
    assertIssue(fixture.check(), 'quiz-option-count', 'steps[2].questions[0].options');
  });

  test('3 options are fine', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      quiz(lesson).questions[0].options = quiz(lesson).questions[0].options.slice(0, 3);
    });
    assertClean(fixture.check());
  });
});

describe('quiz: option length', () => {
  test('options of 10 and 16 characters give quiz-option-length', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      const question = quiz(lesson).questions[0];
      question.options = optionsOfLength(10, 12, 16);
      question.correctOptionId = 'optie-0';
    });
    const error = assertIssue(
      fixture.check(),
      'quiz-option-length',
      'steps[2].questions[0].options',
    );
    assert.match(error.message, /langste optie is 16 tekens, kortste 10/);
  });

  test('options of 10 and 15 characters are fine', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      const question = quiz(lesson).questions[0];
      question.options = optionsOfLength(10, 12, 15);
      question.correctOptionId = 'optie-0';
    });
    assertNoIssue(fixture.check(), 'quiz-option-length');
  });

  test('length is counted without markup and surrounding spaces', () => {
    assert.equal(optionLength('  **Vast** zitten '), 11);
    assert.equal(optionLength('[[aanslaan|Sla aan]]'), 7);
  });
});

describe('quiz: feedback and correct option', () => {
  test('option without feedback is a schema error', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      delete quiz(lesson).questions[1].options[2].feedback;
    });
    assertIssue(fixture.check(), 'schema', 'steps[2].questions[1].options[2].feedback');
  });

  test('whitespace-only feedback is a schema error', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      quiz(lesson).questions[1].options[2].feedback = '   ';
    });
    const error = assertIssue(
      fixture.check(),
      'schema',
      'steps[2].questions[1].options[2].feedback',
    );
    assert.match(error.message, /mag niet leeg zijn/);
  });

  test('unknown correctOptionId gives quiz-correct-option-missing', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      quiz(lesson).questions[3].correctOptionId = 'hogerop';
    });
    assertIssue(
      fixture.check(),
      'quiz-correct-option-missing',
      'steps[2].questions[3].correctOptionId',
    );
  });
});

describe('quiz: number of quiz steps', () => {
  test('course lesson without or with two quiz steps gives quiz-step-count', (t) => {
    const fixture = fixtureRoot(t);
    const original = fixture.readLesson();
    fixture.mutateLesson((lesson) => {
      lesson.steps = lesson.steps.filter((step) => step.type !== 'quiz');
    });
    assertIssue(fixture.check(), 'quiz-step-count', 'steps');
    fixture.mutateLesson(() => {
      const lesson = structuredClone(original);
      const copy = structuredClone(quiz(lesson));
      copy.id = 'quiz-twee';
      copy.questions.forEach((question) => {
        question.id = `${question.id}-twee`;
      });
      lesson.steps.push(copy);
      return lesson;
    });
    assertIssue(fixture.check(), 'quiz-step-count', 'steps');
  });

  test('practice lesson without quiz is fine', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateCourse((course) => {
      Object.assign(course, {
        kind: 'practice',
        subject: 'Natuur',
        schoolLevel: 'Groep 6',
        method: 'Naut',
        chapter: 'Thema 2',
      });
    });
    fixture.mutateLesson((lesson) => {
      lesson.steps = lesson.steps.filter((step) => step.type !== 'quiz');
    });
    const result = fixture.check();
    assertNoIssue(result, 'quiz-step-count');
    assertNoIssue(result, 'schema');
  });
});
