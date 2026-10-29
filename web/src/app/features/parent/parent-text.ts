/** Every text of the parent overview and the page of a child (Dutch, as the parent reads it). */
export const PARENT_TEXT = {
  heading: 'Ouderoverzicht',
  intro: 'Zo gaat het met de kinderen.',
  loading: 'Even snuffelen…',
  noChildren: 'Er zijn nog geen kinderaccounts. Maak ze aan in het beheerscherm, zie de README.',
  unavailable: 'Het ouderoverzicht kan ik nu niet laden.',
  activityUnavailable: 'De voortgang van de kinderen kan ik nu niet ophalen.',
  retry: 'Opnieuw',
  lastActivity: (moment: string) => `Laatst actief: ${moment}`,
  notActive: 'Nog niet actief',
  lessonsCompleted: (count: number) => (count === 1 ? '1 les klaar' : `${count} lessen klaar`),
} as const;

/** Every text of the section on /ouder where the parent chooses who sees a course. */
export const ACCESS_TEXT = {
  heading: 'Wie ziet welke cursus?',
  loading: 'Even snuffelen…',
  unavailable: 'Wie welke cursus ziet, kan ik nu niet ophalen.',
  retry: PARENT_TEXT.retry,
  allChildren: (titles: readonly string[]) => `Voor alle kinderen: ${titles.join(', ')}`,
  saveFailed: 'Opslaan lukt niet. Probeer het nog eens.',
  assigned: (name: string, course: string) => `${name} ziet nu ${course}.`,
  unassigned: (name: string, course: string) =>
    `${name} ziet ${course} niet meer. De voortgang blijft bewaard.`,
} as const;

/** Every text of the page of one child and its lessons. */
export const CHILD_TEXT = {
  back: 'Naar het ouderoverzicht',
  loading: 'Even snuffelen…',
  notFoundHeading: 'Kind niet gevonden',
  notFound: 'Dit kind kan ik niet vinden.',
  unavailableHeading: 'Laden lukt niet',
  unavailable: 'Het overzicht van dit kind kan ik nu niet laden.',
  progressUnavailable: 'De voortgang van dit kind kan ik nu niet ophalen.',
  lessonUnavailable: 'De details van deze les kan ik nu niet laden.',
  retry: PARENT_TEXT.retry,
  courses: 'Leertrajecten',
  practice: 'Huiswerk oefenen',
  lastActivity: PARENT_TEXT.lastActivity,
  notActive: PARENT_TEXT.notActive,
  pageTitle: (name: string) => `${name} · Ouderoverzicht · Snuffel`,
  notFoundTitle: 'Kind niet gevonden · Ouderoverzicht · Snuffel',
  defaultTitle: 'Ouderoverzicht · Snuffel',
  quizScore: (correct: number, questions: number) => `${correct} van ${questions} goed`,
  quizPartly: (answered: number, questions: number, correct: number) =>
    `${answered} van ${questions} beantwoord, ${correct} goed`,
  quizNotDone: 'nog niet gemaakt',
  quizAnswers: (answers: number, hints: number) =>
    `${answers} ${answers === 1 ? 'antwoord' : 'antwoorden'}, ${hints} ${hints === 1 ? 'hint' : 'hints'}`,
  checklist: (checked: number, total: number) => `${checked} van ${total} afgevinkt`,
  gameScore: (score: number, total: number) => `${score} van ${total} goed`,
  exerciseScore: (score: number, total: number) => `${score} van ${total} zelf goed`,
  gamePlays: (plays: number) => `${plays} keer gespeeld`,
  exercisePlays: (plays: number) => `${plays} keer gemaakt`,
  gameNotPlayed: 'nog niet gespeeld',
  exerciseNotDone: 'nog niet gemaakt',
  typingScore: (accuracy: number, keysPerMinute: number | null) =>
    keysPerMinute === null
      ? `${accuracy}% goed`
      : `${accuracy}% goed, ${keysPerMinute} aanslagen per minuut`,
  typingMistakes: (keys: readonly string[]) =>
    `Vaakst fout: ${keys.length > 1 ? `${keys.slice(0, -1).join(', ')} en ${keys[keys.length - 1]}` : keys.join('')}`,
  typingPlays: (plays: number) => `${plays} keer gedaan`,
  typingNotDone: 'nog niet gedaan',
  clear: 'Voortgang wissen',
  clearQuestion: (lesson: string, name: string) =>
    `Alles van ${lesson} voor ${name} wissen? Stappen, quizantwoorden, vinkjes en scores gaan weg. Dit kan niet terug.`,
  clearConfirm: 'Ja, wissen',
  clearCancel: 'Annuleren',
  clearing: 'Bezig met wissen…',
  clearFailed: 'Niet alles is gewist. Probeer het nog eens.',
  cleared: (lesson: string) => `De voortgang van ${lesson} is gewist.`,
  exerciseHelp: (hints: number, solutions: number, exercises: number) =>
    `${hints} ${hints === 1 ? 'hint' : 'hints'}, uitwerking bekeken bij ${solutions} van ${exercises} opgaven`,
} as const;
