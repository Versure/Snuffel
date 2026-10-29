import type { ManifestCourse } from '../content/content.types';
import { canSee, isForAllChildren, visibleCourses, type CourseViewer } from './visible-courses';

const course = (id: string, access: string): Pick<ManifestCourse, 'id' | 'access'> => ({
  id,
  // Also values the app does not know, as an older or newer manifest could have them.
  access: access as ManifestCourse['access'],
});

const blindTypen = course('blind-typen', 'all-children');
const roofvissen = course('roofvissen', 'selected-children');
const nieuw = course('nieuw', 'everyone');

const child = (...assigned: string[]): CourseViewer => ({
  role: 'child',
  assigned: new Set(assigned),
});
const parent: CourseViewer = { role: 'parent' };

describe('visible courses', () => {
  it('an all-children course is seen by every child, with or without assignments', () => {
    expect(isForAllChildren(blindTypen)).toBe(true);
    expect(canSee(blindTypen, child())).toBe(true);
    expect(canSee(blindTypen, child('roofvissen'))).toBe(true);
  });

  it('a selected-children course is seen only with an assignment', () => {
    expect(isForAllChildren(roofvissen)).toBe(false);
    expect(canSee(roofvissen, child())).toBe(false);
    expect(canSee(roofvissen, child('blind-typen'))).toBe(false);
    expect(canSee(roofvissen, child('roofvissen'))).toBe(true);
  });

  it('an unknown access value counts as selected-children', () => {
    expect(isForAllChildren(nieuw)).toBe(false);
    expect(canSee(nieuw, child())).toBe(false);
    expect(canSee(nieuw, child('nieuw'))).toBe(true);
  });

  it('the parent sees every course without assignments', () => {
    for (const candidate of [blindTypen, roofvissen, nieuw]) {
      expect(canSee(candidate, parent)).toBe(true);
    }
    expect(visibleCourses([roofvissen, blindTypen, nieuw], parent)).toEqual([
      roofvissen,
      blindTypen,
      nieuw,
    ]);
  });

  it('visibleCourses keeps the order and leaves out what the child does not see', () => {
    const courses = [roofvissen, blindTypen, nieuw];
    expect(visibleCourses(courses, child())).toEqual([blindTypen]);
    expect(visibleCourses(courses, child('roofvissen'))).toEqual([roofvissen, blindTypen]);
  });

  it('an assignment for a course that is not in the manifest changes nothing', () => {
    const courses = [roofvissen, blindTypen];
    expect(visibleCourses(courses, child('verdwenen-cursus'))).toEqual([blindTypen]);
    expect(visibleCourses(courses, child('verdwenen-cursus', 'roofvissen'))).toEqual(courses);
  });
});
