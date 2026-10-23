import { LESSON_STATUS_TEXT } from '../../shared/ui/lesson-status/lesson-status-text';
import { HOME_TEXT } from '../home/home-text';

/** Every text of the course overview and its lesson items (Dutch, as the child sees it). */
export const COURSE_TEXT = {
  back: 'Naar de start',
  loading: 'Even snuffelen…',
  lessons: 'Lessen',
  goal: 'Doel:',
  successCriterion: 'Gelukt als:',
  begin: (title: string) => `Begin met: ${title}`,
  continue: (title: string) => `Verder met: ${title}`,
  allDone: 'Alles klaar! Goed gesnuffeld.',
  lessonsCompleted: HOME_TEXT.lessonsCompleted,
  progressUnavailable: HOME_TEXT.progressUnavailable,
  retry: HOME_TEXT.retry,
  notFoundHeading: 'Leertraject niet gevonden',
  notFound: 'Dit leertraject kan ik niet vinden.',
  unavailableHeading: 'Leertraject laden lukt niet',
  unavailable: 'Snuffel kan dit leertraject nu niet laden.',
  unsupportedHeading: 'Nieuwere versie nodig',
  unsupportedVersion: HOME_TEXT.unsupportedVersion,
  lessonNumber: (number: number) => `Les ${number}`,
  minutes: (minutes: number) => `Ongeveer ${minutes} minuten`,
  completed: LESSON_STATUS_TEXT.completed,
  started: LESSON_STATUS_TEXT.started,
  new: LESSON_STATUS_TEXT.new,
  planned: LESSON_STATUS_TEXT.planned,
  pageTitle: (title: string) => `${title} · Snuffel`,
  notFoundTitle: 'Leertraject niet gevonden · Snuffel',
  defaultTitle: 'Leertraject · Snuffel',
} as const;
