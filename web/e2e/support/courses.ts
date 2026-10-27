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
}

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
    }));
}

/** The courses under "Leertrajecten", in the order the app shows them. */
export const learningCourses = ofKind('course');
/** The courses under "Huiswerk oefenen", in the order the app shows them. */
export const practiceCourses = ofKind('practice');
/** Every served course, "Leertrajecten" first, as the start page lists them. */
export const servedCourses: readonly ServedCourse[] = [...learningCourses, ...practiceCourses];

/** What the card of a course without progress says. */
export function noProgressText(course: ServedCourse): string {
  return `0 van ${course.lessonCount} lessen klaar`;
}

export interface PublishedLessonId {
  readonly courseId: string;
  readonly lessonId: string;
}

/** Every published lesson of every served course: courses by title, lessons in course order. */
export const publishedLessonIds: readonly PublishedLessonId[] = courses.flatMap((course) =>
  course.lessons
    .filter((entry) => entry.status === 'published')
    .map((entry) => ({ courseId: course.id, lessonId: entry.id })),
);
