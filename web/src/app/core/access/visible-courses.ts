import type { ManifestCourse } from '../content/content.types';

/**
 * Who looks at the courses: the parent sees everything; a child sees every `all-children`
 * course and the `selected-children` courses it is assigned to (`assigned` holds course ids).
 */
export type CourseViewer =
  { readonly role: 'parent' } | { readonly role: 'child'; readonly assigned: ReadonlySet<string> };

/** The part of a manifest course that decides who sees it. */
export type CourseAccessInfo = Pick<ManifestCourse, 'id' | 'access'>;

/** True when every child sees the course without an assignment. */
export function isForAllChildren(course: CourseAccessInfo): boolean {
  return course.access === 'all-children';
}

/**
 * Whether `viewer` sees `course`. Any access value other than `all-children` (also one the app
 * does not know) needs an assignment: rather show too little than too much.
 */
export function canSee(course: CourseAccessInfo, viewer: CourseViewer): boolean {
  if (viewer.role === 'parent') return true;
  if (isForAllChildren(course)) return true;
  return viewer.assigned.has(course.id);
}

/** The courses `viewer` sees, in the given order. */
export function visibleCourses<T extends CourseAccessInfo>(
  courses: readonly T[],
  viewer: CourseViewer,
): T[] {
  return courses.filter((course) => canSee(course, viewer));
}
