/** Every text of the start page and its course cards (Dutch, as the child sees it). */
export const HOME_TEXT = {
  heading: 'Snuffel',
  greeting: (name: string) => `Hoi, ${name}!`,
  question: 'Waar gaan we vandaag op snuffelen?',
  loading: 'Even snuffelen…',
  courses: 'Leertrajecten',
  practice: 'Huiswerk oefenen',
  empty: 'Er staan nog geen leertrajecten klaar. Ted is nog aan het snuffelen.',
  unavailable: 'Snuffel kan de leertrajecten nu niet laden.',
  unsupportedVersion:
    'Deze inhoud is gemaakt voor een nieuwere versie van Snuffel. Ververs de pagina.',
  progressUnavailable: 'Je voortgang kan ik nu niet ophalen.',
  retry: 'Opnieuw',
  lessonsCompleted: (completed: number, total: number) =>
    completed >= total ? 'Alle lessen klaar!' : `${completed} van ${total} lessen klaar`,
} as const;
