import type { ManifestCourse, ManifestLesson } from '../content/content.types';
import type { LessonProgressRecord } from '../pocketbase/types';
import {
  courseProgress,
  groupStepStatuses,
  lessonProgress,
  nextLesson,
  type StepStatusRecord,
} from './course-progress';

const proefles: ManifestLesson = {
  id: 'proefles',
  title: 'Proefles',
  status: 'published',
  version: 2,
  estimatedMinutes: 10,
  file: 'proefcursus/lessons/proefles.json',
  hash: '0123456789abcdef',
  stepIds: ['uitleg', 'spel', 'quiz', 'zelf-doen'],
};

const tweede: ManifestLesson = {
  id: 'tweede',
  title: 'Tweede',
  status: 'published',
  version: 1,
  estimatedMinutes: 9,
  file: 'proefcursus/lessons/tweede.json',
  hash: 'fedcba9876543210',
  stepIds: ['uitleg', 'quiz'],
};

const later: ManifestLesson = { id: 'proefles-later', title: 'Later', status: 'planned' };

const course: ManifestCourse = {
  id: 'proefcursus',
  title: 'Proefcursus',
  kind: 'course',
  access: 'all-children',
  file: 'proefcursus/course.json',
  hash: '1111111111111111',
  lessons: [proefles, tweede, later],
  assets: [],
};

const record = (
  lessonId: string,
  stepId: string,
  status: 'started' | 'completed',
): StepStatusRecord => ({ lesson_id: lessonId, step_id: stepId, status });

const allCompleted = (lesson: ManifestLesson) =>
  (lesson.stepIds ?? []).map((stepId) => record(lesson.id, stepId, 'completed'));

describe('course progress', () => {
  it('a lesson without records is new', () => {
    expect(lessonProgress(proefles, groupStepStatuses([]))).toEqual({
      status: 'new',
      done: 0,
      total: 4,
    });
  });

  it('a lesson with one started step is started', () => {
    const statuses = groupStepStatuses([record('proefles', 'uitleg', 'started')]);
    expect(lessonProgress(proefles, statuses)).toEqual({ status: 'started', done: 0, total: 4 });
  });

  it('a lesson with every step completed is completed', () => {
    const statuses = groupStepStatuses(allCompleted(proefles));
    expect(lessonProgress(proefles, statuses)).toEqual({
      status: 'completed',
      done: 4,
      total: 4,
    });
  });

  it('completed counts whatever the content version', () => {
    const records: LessonProgressRecord[] = (proefles.stepIds ?? []).map((stepId, index) => ({
      id: `p-${stepId}`,
      user: 'kind-a',
      created: '',
      updated: '',
      course_id: 'proefcursus',
      lesson_id: 'proefles',
      step_id: stepId,
      status: 'completed',
      // Older than the lesson (version 2), and newer.
      content_version: index === 0 ? 1 : 3,
    }));
    expect(lessonProgress(proefles, groupStepStatuses(records)).status).toBe('completed');
  });

  it('a record for a step the lesson no longer has does not count', () => {
    const statuses = groupStepStatuses([record('proefles', 'weg', 'completed')]);
    expect(lessonProgress(proefles, statuses)).toEqual({ status: 'new', done: 0, total: 4 });
    const started = groupStepStatuses([
      record('proefles', 'weg', 'completed'),
      record('proefles', 'uitleg', 'completed'),
    ]);
    expect(lessonProgress(proefles, started)).toEqual({ status: 'started', done: 1, total: 4 });
  });

  it('a record for a lesson that is not in the manifest does not count', () => {
    const statuses = groupStepStatuses([
      ...allCompleted({ ...proefles, id: 'verdwenen' }),
      record('verdwenen', 'uitleg', 'completed'),
    ]);
    expect(courseProgress(course, statuses)).toEqual({ completed: 0, total: 3 });
    expect(nextLesson(course, statuses)).toEqual({ lesson: proefles, status: 'new' });
  });

  it('a new step in a completed lesson makes it started again', () => {
    const statuses = groupStepStatuses(allCompleted(proefles));
    const grown: ManifestLesson = { ...proefles, stepIds: [...(proefles.stepIds ?? []), 'extra'] };
    expect(lessonProgress(grown, statuses)).toEqual({ status: 'started', done: 4, total: 5 });
  });

  it('a planned lesson is planned and has no steps', () => {
    const statuses = groupStepStatuses([record('proefles-later', 'uitleg', 'completed')]);
    expect(lessonProgress(later, statuses)).toEqual({ status: 'planned', done: 0, total: 0 });
  });

  it('the course counts completed lessons of all lessons, planned included', () => {
    expect(courseProgress(course, groupStepStatuses([]))).toEqual({ completed: 0, total: 3 });
    const statuses = groupStepStatuses([
      ...allCompleted(proefles),
      record('tweede', 'uitleg', 'completed'),
    ]);
    expect(courseProgress(course, statuses)).toEqual({ completed: 1, total: 3 });
    const both = groupStepStatuses([...allCompleted(proefles), ...allCompleted(tweede)]);
    expect(courseProgress(course, both)).toEqual({ completed: 2, total: 3 });
  });

  it('the next lesson is the first published lesson that is not completed', () => {
    expect(nextLesson(course, groupStepStatuses([]))).toEqual({ lesson: proefles, status: 'new' });
    const first = groupStepStatuses([record('proefles', 'spel', 'started')]);
    expect(nextLesson(course, first)).toEqual({ lesson: proefles, status: 'started' });
    const second = groupStepStatuses([
      ...allCompleted(proefles),
      record('tweede', 'uitleg', 'completed'),
    ]);
    expect(nextLesson(course, second)).toEqual({ lesson: tweede, status: 'started' });
    const untouched = groupStepStatuses(allCompleted(proefles));
    expect(nextLesson(course, untouched)).toEqual({ lesson: tweede, status: 'new' });
  });

  it('there is no next lesson when every published lesson is completed', () => {
    const statuses = groupStepStatuses([...allCompleted(proefles), ...allCompleted(tweede)]);
    expect(nextLesson(course, statuses)).toBeNull();
  });
});
