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

/**
 * Every `sourceRefs` list with its path: blocks (on signal cards per card), quiz questions,
 * checklist items and interaction steps. `[{ path, refs }]`.
 */
export function sourceRefLists(lesson) {
  const lists = [];
  lesson.steps.forEach((step, s) => {
    const stepPath = `steps[${s}]`;
    if (step.type === 'explain') {
      step.blocks.forEach((block, b) => {
        const blockPath = `${stepPath}.blocks[${b}]`;
        if (block.type === 'signal-cards') {
          block.cards.forEach((card, c) =>
            lists.push({ path: `${blockPath}.cards[${c}].sourceRefs`, refs: card.sourceRefs }),
          );
        } else {
          lists.push({ path: `${blockPath}.sourceRefs`, refs: block.sourceRefs });
        }
      });
    }
    if (step.type === 'interaction') {
      lists.push({ path: `${stepPath}.sourceRefs`, refs: step.sourceRefs });
    }
    if (step.type === 'quiz') {
      step.questions.forEach((question, q) =>
        lists.push({ path: `${stepPath}.questions[${q}].sourceRefs`, refs: question.sourceRefs }),
      );
    }
    if (step.type === 'practice') {
      step.items.forEach((item, i) =>
        lists.push({ path: `${stepPath}.items[${i}].sourceRefs`, refs: item.sourceRefs }),
      );
    }
  });
  return lists;
}

/**
 * Every text field of a lesson with its path: `[{ path, text, reading, glossary }]`.
 *
 * `reading` marks the text a child reads anyway (counted for reading time and sentence length):
 * the objective, Ted's intro, step and block titles, all block and card text, the intros of quiz,
 * interaction and practice steps, questions and options, checklist items and the success
 * criterion. Feedback, hints, Ted's reactions, interaction texts, further reading and the FAQ
 * are optional or part of the minute per question, and do not count.
 * `glossary` marks the glossary itself (its terms and definitions are not checked for terms).
 */
export function lessonTexts(lesson) {
  const texts = [];
  const add = (path, text, reading = false, glossary = false) =>
    texts.push({ path, text, reading, glossary });

  add('title', lesson.title);
  add('sticker', lesson.sticker);
  add('objective', lesson.objective, true);
  add('concept', lesson.concept);
  lesson.glossary.forEach((entry, g) => {
    add(`glossary[${g}].term`, entry.term, false, true);
    add(`glossary[${g}].definition`, entry.definition, false, true);
  });
  add('ted.intro.text', lesson.ted.intro.text, true);
  lesson.ted.correct.forEach((text, i) => add(`ted.correct[${i}]`, text));
  lesson.ted.incorrect.forEach((text, i) => add(`ted.incorrect[${i}]`, text));
  add('ted.finished', lesson.ted.finished);

  lesson.steps.forEach((step, s) => {
    const stepPath = `steps[${s}]`;
    add(`${stepPath}.title`, step.title, true);
    if (step.type === 'explain') {
      step.blocks.forEach((block, b) => {
        const blockPath = `${stepPath}.blocks[${b}]`;
        if (block.type === 'signal-cards') {
          block.cards.forEach((card, c) => {
            add(`${blockPath}.cards[${c}].title`, card.title, true);
            add(`${blockPath}.cards[${c}].text`, card.text, true);
          });
          return;
        }
        if (block.title !== undefined) add(`${blockPath}.title`, block.title, true);
        if (block.text !== undefined) add(`${blockPath}.text`, block.text, true);
        if (block.type === 'figure') {
          add(`${blockPath}.alt`, block.alt);
          if (block.caption !== undefined) add(`${blockPath}.caption`, block.caption, true);
        }
      });
    }
    if (step.type === 'interaction') {
      add(`${stepPath}.intro`, step.intro, true);
      interactionTexts(step.interaction, `${stepPath}.interaction.config`, add);
    }
    if (step.type === 'quiz') {
      if (step.intro !== undefined) add(`${stepPath}.intro`, step.intro, true);
      step.questions.forEach((question, q) => {
        const questionPath = `${stepPath}.questions[${q}]`;
        add(`${questionPath}.prompt`, question.prompt, true);
        question.options.forEach((option, o) => {
          add(`${questionPath}.options[${o}].text`, option.text, true);
          add(`${questionPath}.options[${o}].feedback`, option.feedback);
        });
        question.hints.forEach((hint, h) => add(`${questionPath}.hints[${h}]`, hint));
      });
    }
    if (step.type === 'practice') {
      add(`${stepPath}.intro`, step.intro, true);
      step.items.forEach((item, i) => {
        add(`${stepPath}.items[${i}].text`, item.text, true);
        (item.links ?? []).forEach((link, l) =>
          add(`${stepPath}.items[${i}].links[${l}].label`, link.label),
        );
      });
      add(`${stepPath}.successCriterion`, step.successCriterion, true);
    }
  });

  lesson.furtherReading.forEach((entry, f) => add(`furtherReading[${f}].why`, entry.why));
  lesson.faq.forEach((entry, f) => {
    add(`faq[${f}].q`, entry.q);
    add(`faq[${f}].a`, entry.a);
  });
  return texts;
}

function interactionTexts({ kind, config }, base, add) {
  if (kind === 'trace-game') {
    config.choices.forEach((choice, c) => add(`${base}.choices[${c}].label`, choice.label));
    config.patterns.forEach((pattern, p) =>
      add(`${base}.patterns[${p}].explanation`, pattern.explanation),
    );
  }
  if (kind === 'stepped-exercise') {
    config.exercises.forEach((exercise, e) => {
      const path = `${base}.exercises[${e}]`;
      add(`${path}.prompt`, exercise.prompt);
      exercise.hints.forEach((hint, h) => add(`${path}.hints[${h}]`, hint));
      exercise.steps.forEach((part, p) => {
        add(`${path}.steps[${p}].title`, part.title);
        add(`${path}.steps[${p}].text`, part.text);
      });
      exercise.commonMistakes.forEach((mistake, m) => {
        add(`${path}.commonMistakes[${m}].answer`, mistake.answer);
        add(`${path}.commonMistakes[${m}].feedback`, mistake.feedback);
      });
      add(`${path}.workedSolution`, exercise.workedSolution);
      const { answer } = exercise;
      if (answer.type === 'choice') {
        answer.options.forEach((option, o) =>
          add(`${path}.answer.options[${o}].text`, option.text),
        );
      }
      if (answer.type === 'text') {
        answer.accepted.forEach((text, a) => add(`${path}.answer.accepted[${a}]`, text));
      }
      if (answer.type === 'number' && answer.unit !== undefined) {
        add(`${path}.answer.unit`, answer.unit);
      }
    });
  }
}
