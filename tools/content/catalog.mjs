// The fixed catalogue of interactions (content/schema/v1/catalogus.md): minutes per interaction
// step as a function of its config, used for the reading time of a lesson.
export const interactionCatalog = {
  'trace-game': { minutes: () => 2 },
  'stepped-exercise': { minutes: () => 2 },
  // A beginner types about 60 keys a minute, plus a minute for the start and the result.
  'typing-drill': {
    minutes: (config) => {
      const chars = config.lines.reduce((sum, line) => sum + [...line].length, 0);
      return Math.round((1 + chars / 60) * 10) / 10;
    },
  },
};

/** The minutes of one interaction step (`{ kind, config }`). */
export function interactionMinutes({ kind, config }) {
  return interactionCatalog[kind].minutes(config);
}

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
