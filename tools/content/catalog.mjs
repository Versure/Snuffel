// The fixed catalogue of interactions (content/schema/v1/catalogus.md): minutes per interaction
// step, used for the reading time of a lesson.
export const interactionCatalog = {
  'trace-game': { minutes: 2 },
  'stepped-exercise': { minutes: 2 },
};

/** Didactic limits from the implementation plan (2.4), as used by the checks. */
export const limits = {
  wordsPerMinute: 130,
  minutesPerQuestion: 1,
  minMinutes: 8,
  maxMinutes: 12,
  maxEstimateDeviation: 2,
  minQuestions: 3,
  maxQuestions: 5,
  minOptions: 3,
  maxOptions: 4,
  maxOptionLengthRatio: 1.5,
  maxAverageSentenceWords: 15,
};
