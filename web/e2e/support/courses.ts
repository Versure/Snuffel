import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Course } from '../../src/app/core/content/content.types';
import { plainText } from '../../src/app/shared/inline-text/inline-markup';

// Every course the e2e build serves (pree2e builds with --fixtures), read from disk: the real
// courses in content/courses and the fixtures in content/fixtures/courses. Tests that list courses
// take their expectations from here, so a new course needs no test edit.

const contentDir = resolve(__dirname, '..', '..', '..', 'content');

export interface ServedCourse {
  readonly id: string;
  /** The title as the app shows it (plain text). */
  readonly title: string;
  /** Every lesson of the course, planned ones included: the N of "0 van N lessen klaar". */
  readonly lessonCount: number;
  /** Who sees the course; all-children when course.json has no access (as content:build). */
  readonly access: CourseAccessValue;
}

type CourseAccessValue = NonNullable<Course['access']>;

const accessOf = (course: Course): CourseAccessValue => course.access ?? 'all-children';

function readCourses(dir: string): Course[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(
      (entry) =>
        JSON.parse(readFileSync(resolve(dir, entry.name, 'course.json'), 'utf8')) as Course,
    );
}

// Sorted on the title as written, like the start page and the parent's page.
const courses = [
  ...readCourses(resolve(contentDir, 'courses')),
  ...readCourses(resolve(contentDir, 'fixtures', 'courses')),
].sort((a, b) => a.title.localeCompare(b.title, 'nl'));

function ofKind(kind: Course['kind']): readonly ServedCourse[] {
  return courses
    .filter((course) => course.kind === kind)
    .map((course) => ({
      id: course.id,
      title: plainText(course.title),
      lessonCount: course.lessons.length,
      access: accessOf(course),
    }));
}

const forEveryChild = (course: ServedCourse) => course.access === 'all-children';

/** The courses under "Leertrajecten", in the order the app shows them. */
export const learningCourses = ofKind('course');
/** The courses under "Huiswerk oefenen", in the order the app shows them. */
export const practiceCourses = ofKind('practice');
/** Every served course, "Leertrajecten" first, as the start page lists them (for the parent). */
export const servedCourses: readonly ServedCourse[] = [...learningCourses, ...practiceCourses];

/** The "Leertrajecten" a new child without assignments sees, in the order the app shows them. */
export const childLearningCourses = learningCourses.filter(forEveryChild);
/** The "Huiswerk oefenen" a new child without assignments sees. */
export const childPracticeCourses = practiceCourses.filter(forEveryChild);
/** Every course a new child without assignments sees, as its start page lists them. */
export const childCourses: readonly ServedCourse[] = [
  ...childLearningCourses,
  ...childPracticeCourses,
];

/** What the card of a course without progress says. */
export function noProgressText(course: ServedCourse): string {
  return `0 van ${course.lessonCount} lessen klaar`;
}

export interface PublishedLessonId {
  readonly courseId: string;
  readonly lessonId: string;
  /** Who sees the course of the lesson. */
  readonly courseAccess: CourseAccessValue;
}

/** Every published lesson of every served course: courses by title, lessons in course order. */
export const publishedLessonIds: readonly PublishedLessonId[] = courses.flatMap((course) =>
  course.lessons
    .filter((entry) => entry.status === 'published')
    .map((entry) => ({ courseId: course.id, lessonId: entry.id, courseAccess: accessOf(course) })),
);

/** The courses a test child needs assigned to open a lesson of `id`'s course. */
export function coursesToAssign(id: PublishedLessonId): readonly string[] {
  return id.courseAccess === 'all-children' ? [] : [id.courseId];
}
