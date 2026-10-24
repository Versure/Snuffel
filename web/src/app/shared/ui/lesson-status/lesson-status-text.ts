/** The labels of a lesson status (Dutch, as the child and the parent see them). */
export const LESSON_STATUS_TEXT = {
  completed: 'Klaar',
  started: (done: number, total: number) => `Bezig: ${done} van ${total} stappen klaar`,
  new: 'Nieuw',
  planned: 'Komt nog',
} as const;
