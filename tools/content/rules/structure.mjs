// Structure: lesson files match course.json, and ids are unique where they must be.
import { checkAnswer, parseNumber } from '../answer.mjs';
import { composedChar, deadKeySequences, keysOfLine } from '../typing.mjs';
import { interactionConfigIds, lessonIds } from '../walk.mjs';

function issue(code, file, path, message) {
  return { code, file, path, message };
}

/** Reports a duplicate for every id seen before in the same scope (mentioning both places). */
function findDuplicates(entries, issues, describe = (entry) => `"${entry.id}"`) {
  const seen = new Map();
  for (const entry of entries) {
    const key = `${entry.scope}|${entry.key ?? entry.id}`;
    const first = seen.get(key);
    if (first) {
      issues.push(
        issue(
          'id-duplicate',
          entry.file,
          entry.path,
          `${describe(entry)} komt dubbel voor; eerder in ${first.file} bij ${first.path}`,
        ),
      );
    } else {
      seen.set(key, entry);
    }
  }
}

export function checkStructure({ courses }) {
  const issues = [];
  const courseIds = [];
  const lessonEntryIds = [];

  for (const course of courses) {
    const { data, file } = course;
    if (data.id !== course.name) {
      issues.push(
        issue(
          'course-id-mismatch',
          file,
          'id',
          `het cursus-id "${data.id}" moet gelijk zijn aan de mapnaam "${course.name}"`,
        ),
      );
    }
    courseIds.push({ id: data.id, file, path: 'id', scope: 'courses' });
    data.lessons.forEach((entry, index) =>
      lessonEntryIds.push({ id: entry.id, file, path: `lessons[${index}].id`, scope: 'lessons' }),
    );
    const sourceIds = data.sources.map((source, index) => ({
      id: source.id,
      file,
      path: `sources[${index}].id`,
      scope: 'sources',
    }));
    findDuplicates(sourceIds, issues, (entry) => `bron-id "${entry.id}"`);

    const referenced = new Set();
    data.lessons.forEach((entry, index) => {
      if (entry.status !== 'published') return;
      referenced.add(entry.file);
      const lessonFile = course.lessonFiles.find((candidate) => candidate.name === entry.file);
      if (!lessonFile) {
        issues.push(
          issue(
            'lesson-file-missing',
            file,
            `lessons[${index}].file`,
            `lesbestand ${course.relDir}/${entry.file} bestaat niet`,
          ),
        );
        return;
      }
      if (lessonFile.data.id !== entry.id) {
        issues.push(
          issue(
            'lesson-id-mismatch',
            lessonFile.file,
            'id',
            `het les-id "${lessonFile.data.id}" moet gelijk zijn aan het id in course.json ("${entry.id}")`,
          ),
        );
      }
    });
    for (const lessonFile of course.lessonFiles) {
      if (!referenced.has(lessonFile.name)) {
        issues.push(
          issue(
            'lesson-file-orphan',
            lessonFile.file,
            '',
            `dit lesbestand staat niet als gepubliceerde les in ${file}`,
          ),
        );
      }
    }

    for (const lesson of course.lessons) {
      checkLessonIds(lesson, issues);
    }
  }

  findDuplicates(courseIds, issues, (entry) => `cursus-id "${entry.id}"`);
  findDuplicates(lessonEntryIds, issues, (entry) => `les-id "${entry.id}"`);
  return issues;
}

function checkLessonIds({ file, data }, issues) {
  const ids = lessonIds(data).map((entry) => ({ ...entry, file }));
  findDuplicates(ids, issues);
  const config = interactionConfigIds(data).map((entry) => ({ ...entry, file }));
  findDuplicates(config, issues);
  const terms = data.glossary.map((entry, index) => ({
    id: entry.term,
    key: entry.term.trim().toLocaleLowerCase('nl'),
    file,
    path: `glossary[${index}].term`,
    scope: 'glossary',
  }));
  findDuplicates(terms, issues, (entry) => `term "${entry.id}"`);

  data.steps.forEach((step, s) => {
    if (step.type !== 'interaction') return;
    const base = `steps[${s}].interaction.config`;
    const { kind, config } = step.interaction;
    if (kind === 'trace-game') {
      const choices = new Set(config.choices.map((choice) => choice.id));
      config.patterns.forEach((pattern, p) => {
        if (!choices.has(pattern.answer)) {
          issues.push(
            issue(
              'interaction-answer-unknown',
              file,
              `${base}.patterns[${p}].answer`,
              `antwoord "${pattern.answer}" is geen van de keuzes (${[...choices].join(', ')})`,
            ),
          );
        }
      });
    }
    if (kind === 'stepped-exercise') {
      config.exercises.forEach((exercise, e) => {
        checkExercise(exercise, `${base}.exercises[${e}]`, file, issues);
      });
    }
    if (kind === 'typing-drill') {
      checkTypingDrill(config, base, file, issues);
    }
  });
}

/** New keys that no line uses, and dead keys that US-International composes (typing.mjs). */
function checkTypingDrill(config, base, file, issues) {
  const used = new Set(config.lines.flatMap((line) => keysOfLine(line)));
  config.newKeys.forEach((key, k) => {
    if (!used.has(key)) {
      issues.push(
        issue(
          'typing-new-key-unused',
          file,
          `${base}.newKeys[${k}]`,
          `toets "${key}" staat in newKeys maar in geen enkele regel`,
        ),
      );
    }
  });
  config.lines.forEach((line, l) => {
    for (const { sequence } of deadKeySequences(line)) {
      issues.push(
        issue(
          'typing-dead-key-sequence',
          file,
          `${base}.lines[${l}]`,
          `${sequence} wordt op een US-International-toetsenbord ${composedChar(sequence)}; zet er een spatie of een andere letter achter`,
        ),
      );
    }
  });
}

/** The answer and the common mistakes of one exercise (see tools/content/answer.mjs). */
function checkExercise(exercise, path, file, issues) {
  const { answer, commonMistakes } = exercise;
  const options = answer.type === 'choice' ? answer.options.map((option) => option.id) : [];
  if (answer.type === 'choice' && !options.includes(answer.correctOptionId)) {
    issues.push(
      issue(
        'interaction-answer-unknown',
        file,
        `${path}.answer.correctOptionId`,
        `juiste optie "${answer.correctOptionId}" is geen van de opties (${options.join(', ')})`,
      ),
    );
  }
  commonMistakes.forEach((mistake, m) => {
    const at = `${path}.commonMistakes[${m}].answer`;
    // Compared as in answer.mjs: spaces around the id do not count.
    if (answer.type === 'choice' && !options.includes(mistake.answer.trim())) {
      issues.push(
        issue(
          'interaction-answer-unknown',
          file,
          at,
          `fout antwoord "${mistake.answer}" is geen id van een optie (${options.join(', ')})`,
        ),
      );
      return;
    }
    if (answer.type === 'number' && parseNumber(mistake.answer, answer.unit) === null) {
      issues.push(
        issue(
          'exercise-mistake-unreadable',
          file,
          at,
          `fout antwoord "${mistake.answer}" is geen getal, dus de app herkent het nooit`,
        ),
      );
      return;
    }
    if (checkAnswer(answer, mistake.answer, []).outcome === 'correct') {
      issues.push(
        issue(
          'exercise-mistake-accepted',
          file,
          at,
          `fout antwoord "${mistake.answer}" telt als goed antwoord; haal het weg of pas het antwoord aan`,
        ),
      );
    }
  });
}
