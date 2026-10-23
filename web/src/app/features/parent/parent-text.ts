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
