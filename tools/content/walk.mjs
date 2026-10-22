// Walks a (schema-valid) lesson and lists the parts the rules look at, each with its JSON path.

/**
 * Ids that progress hangs on, unique within the lesson (one namespace): step ids
 * (lesson_progress.step_id, and checklist_states.checklist_id for practice steps), question ids,
 * interaction ids and checklist item ids. Option ids are unique per question (`scope`).
 *
 * Returns `[{ kind, id, path, parent, scope }]`; `parent` is the id of the step (or question for
 * an option) it belongs to, `scope` is where it must be unique.
 */
export function lessonIds(lesson) {
  const ids = [];
  lesson.steps.forEach((step, s) => {
    const stepPath = `steps[${s}]`;
    ids.push({ kind: 'step', id: step.id, path: `${stepPath}.id`, parent: '', scope: 'lesson' });
    if (step.type === 'quiz') {
      step.questions.forEach((question, q) => {
        const questionPath = `${stepPath}.questions[${q}]`;
        ids.push({
          kind: 'question',
          id: question.id,
          path: `${questionPath}.id`,
          parent: step.id,
          scope: 'lesson',
        });
        question.options.forEach((option, o) => {
          ids.push({
            kind: 'option',
            id: option.id,
            path: `${questionPath}.options[${o}].id`,
            parent: question.id,
            scope: `question:${question.id}`,
          });
        });
      });
    }
    if (step.type === 'interaction') {
      ids.push({
        kind: 'interaction',
        id: step.interaction.id,
        path: `${stepPath}.interaction.id`,
        parent: step.id,
        scope: 'lesson',
      });
    }
    if (step.type === 'practice') {
      step.items.forEach((item, i) => {
        ids.push({
          kind: 'item',
          id: item.id,
          path: `${stepPath}.items[${i}].id`,
          parent: step.id,
          scope: 'lesson',
        });
      });
    }
  });
  return ids;
}

/**
 * Ids inside interaction configs (no progress hangs on them, but a duplicate is a bug):
 * `[{ id, path, scope }]`.
 */
export function interactionConfigIds(lesson) {
  const ids = [];
  lesson.steps.forEach((step, s) => {
    if (step.type !== 'interaction') return;
    const base = `steps[${s}].interaction.config`;
    const { kind, config } = step.interaction;
    if (kind === 'trace-game') {
      config.choices.forEach((choice, c) =>
        ids.push({ id: choice.id, path: `${base}.choices[${c}].id`, scope: `${base}.choices` }),
      );
      config.patterns.forEach((pattern, p) =>
        ids.push({ id: pattern.id, path: `${base}.patterns[${p}].id`, scope: `${base}.patterns` }),
      );
    }
    if (kind === 'stepped-exercise') {
      config.exercises.forEach((exercise, e) => {
        const exercisePath = `${base}.exercises[${e}]`;
        ids.push({ id: exercise.id, path: `${exercisePath}.id`, scope: `${base}.exercises` });
        exercise.steps.forEach((part, p) =>
          ids.push({
            id: part.id,
            path: `${exercisePath}.steps[${p}].id`,
            scope: `${exercisePath}.steps`,
          }),
        );
        if (exercise.answer.type === 'choice') {
          exercise.answer.options.forEach((option, o) =>
            ids.push({
              id: option.id,
              path: `${exercisePath}.answer.options[${o}].id`,
              scope: `${exercisePath}.answer.options`,
            }),
          );
        }
      });
    }
  });
  return ids;
}
