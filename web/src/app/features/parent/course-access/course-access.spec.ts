import { TestBed } from '@angular/core/testing';
import { CourseAccessService } from '../../../core/access/course-access.service';
import type { ManifestCourse } from '../../../core/content/content.types';
import type { CourseAssignmentRecord, UserRecord } from '../../../core/pocketbase/types';
import { ProgressError } from '../../../core/progress/progress-error';
import { CourseAccess } from './course-access';

const course = (id: string, title: string, access: ManifestCourse['access']): ManifestCourse => ({
  id,
  title,
  kind: 'course',
  access,
  file: `${id}/course.json`,
  hash: '0123456789abcdef',
  lessons: [],
  assets: [],
});

const roofvissen = course('roofvissen', 'Roofvissen', 'selected-children');
const geheim = course('geheim', 'Aardrijkskunde', 'selected-children');
const blindTypen = course('blind-typen', 'Blind typen', 'all-children');
const proefcursus = course('proefcursus', 'Proefcursus', 'all-children');

const child = (id: string, name: string): UserRecord => ({
  id,
  name,
  username: name.toLowerCase().replace(' ', '-'),
  role: 'child',
});
const kindA = child('a1', 'Kind A');
const kindB = child('b1', 'Kind B');

const record = (id: string, user: string, courseId: string): CourseAssignmentRecord => ({
  id,
  user,
  course_id: courseId,
  created: '2026-10-29 08:00:00.000Z',
  updated: '2026-10-29 08:00:00.000Z',
});

const textOf = (element: Element | null | undefined) =>
  (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('CourseAccess', () => {
  let assignments: CourseAssignmentRecord[];
  let loadFails: boolean;
  let loadAssignments: ReturnType<typeof vi.fn<CourseAccessService['loadAssignments']>>;
  let assign: ReturnType<typeof vi.fn<CourseAccessService['assign']>>;
  let unassign: ReturnType<typeof vi.fn<CourseAccessService['unassign']>>;

  beforeEach(() => {
    assignments = [record('x1', 'a1', 'roofvissen')];
    loadFails = false;
    loadAssignments = vi.fn<CourseAccessService['loadAssignments']>(async () => {
      if (loadFails) throw new ProgressError('unavailable', 'test');
      return assignments;
    });
    assign = vi.fn<CourseAccessService['assign']>(async (user, courseId) =>
      record('nieuw', user, courseId),
    );
    unassign = vi.fn<CourseAccessService['unassign']>(async () => undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: CourseAccessService, useValue: { loadAssignments, assign, unassign } },
      ],
    });
  });

  async function render(
    courses: ManifestCourse[] = [roofvissen, blindTypen, geheim, proefcursus],
    children: UserRecord[] = [kindA, kindB],
  ) {
    const fixture = TestBed.createComponent(CourseAccess);
    fixture.componentRef.setInput('courses', courses);
    fixture.componentRef.setInput('children', children);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const group = (title: string) =>
      Array.from(element.querySelectorAll('fieldset')).find(
        (fieldset) => textOf(fieldset.querySelector('legend')) === title,
      );
    const checkbox = (title: string, name: string) => {
      const label = Array.from(group(title)?.querySelectorAll('label') ?? []).find(
        (candidate) => textOf(candidate) === name,
      );
      return label?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? null;
    };
    const status = () => textOf(element.querySelector('[aria-live="polite"]'));
    return { fixture, element, group, checkbox, status };
  }

  it('has a heading and a group per selected-children course, sorted on title', async () => {
    const { element } = await render();
    expect(textOf(element.querySelector('h2'))).toBe('Wie ziet welke cursus?');
    expect(Array.from(element.querySelectorAll('fieldset legend')).map(textOf)).toEqual([
      'Aardrijkskunde',
      'Roofvissen',
    ]);
  });

  it('every checkbox has a label with the name of the child', async () => {
    const { group } = await render();
    const labels = Array.from(group('Roofvissen')?.querySelectorAll('label') ?? []);
    expect(labels.map(textOf)).toEqual(['Kind A', 'Kind B']);
    for (const label of labels) {
      const input = label.querySelector('input');
      expect(input?.type).toBe('checkbox');
      expect(label.getAttribute('for')).toBe(input?.id);
    }
  });

  it('the checkboxes follow the assignments', async () => {
    const { checkbox } = await render();
    expect(checkbox('Roofvissen', 'Kind A')?.checked).toBe(true);
    expect(checkbox('Roofvissen', 'Kind B')?.checked).toBe(false);
    expect(checkbox('Aardrijkskunde', 'Kind A')?.checked).toBe(false);
  });

  it('ticking a box assigns the course and says so', async () => {
    let resolve!: (value: CourseAssignmentRecord) => void;
    assign.mockImplementation(() => new Promise((done) => (resolve = done)));
    const { fixture, checkbox, status } = await render();
    const box = checkbox('Roofvissen', 'Kind B');
    box?.click();
    fixture.detectChanges();
    expect(assign).toHaveBeenCalledWith('b1', 'roofvissen');
    // While saving the box keeps the choice and cannot be changed.
    expect(box?.checked).toBe(true);
    expect(box?.disabled).toBe(true);
    resolve(record('nieuw', 'b1', 'roofvissen'));
    await fixture.whenStable();
    expect(box?.checked).toBe(true);
    expect(box?.disabled).toBe(false);
    expect(status()).toBe('Kind B ziet nu Roofvissen.');
  });

  it('unticking a box removes the assignment with its id and keeps the progress', async () => {
    const { fixture, checkbox, status } = await render();
    const box = checkbox('Roofvissen', 'Kind A');
    box?.click();
    await fixture.whenStable();
    expect(unassign).toHaveBeenCalledWith('x1');
    expect(box?.checked).toBe(false);
    expect(status()).toBe('Kind A ziet Roofvissen niet meer. De voortgang blijft bewaard.');
  });

  it('a new assignment can be removed again with its new id', async () => {
    const { fixture, checkbox } = await render();
    const box = checkbox('Roofvissen', 'Kind B');
    box?.click();
    await fixture.whenStable();
    box?.click();
    await fixture.whenStable();
    expect(unassign).toHaveBeenCalledWith('nieuw');
    expect(box?.checked).toBe(false);
  });

  it('a failed save sets the box back and says so', async () => {
    assign.mockRejectedValue(new ProgressError('unavailable', 'test'));
    unassign.mockRejectedValue(new ProgressError('unavailable', 'test'));
    const { fixture, checkbox, status } = await render();
    const ticked = checkbox('Roofvissen', 'Kind B');
    ticked?.click();
    await fixture.whenStable();
    expect(ticked?.checked).toBe(false);
    expect(ticked?.disabled).toBe(false);
    expect(status()).toBe('Opslaan lukt niet. Probeer het nog eens.');

    const unticked = checkbox('Roofvissen', 'Kind A');
    unticked?.click();
    await fixture.whenStable();
    expect(unticked?.checked).toBe(true);
    expect(status()).toBe('Opslaan lukt niet. Probeer het nog eens.');
  });

  it('after a failed save the assignments load again and the boxes follow the server', async () => {
    // Another tab already assigned Kind B and removed Kind A: the server says 400 and 404.
    assign.mockImplementation(async () => {
      assignments = [record('y1', 'b1', 'roofvissen')];
      throw new ProgressError('unavailable', 'test');
    });
    unassign.mockRejectedValue(new ProgressError('unavailable', 'test'));
    const { fixture, element, checkbox, status } = await render();
    expect(loadAssignments).toHaveBeenCalledTimes(1);

    checkbox('Roofvissen', 'Kind B')?.click();
    // While the assignments load again the boxes stay (no loading text in between).
    fixture.detectChanges();
    expect(element.querySelector('.loading')).toBeNull();
    await fixture.whenStable();
    expect(loadAssignments).toHaveBeenCalledTimes(2);
    expect(checkbox('Roofvissen', 'Kind B')?.checked).toBe(true);
    expect(checkbox('Roofvissen', 'Kind A')?.checked).toBe(false);
    expect(status()).toBe('Opslaan lukt niet. Probeer het nog eens.');

    // Unticking Kind B now uses the id from the server.
    assignments = [];
    checkbox('Roofvissen', 'Kind B')?.click();
    await fixture.whenStable();
    expect(unassign).toHaveBeenCalledWith('y1');
    expect(loadAssignments).toHaveBeenCalledTimes(3);
    expect(checkbox('Roofvissen', 'Kind B')?.checked).toBe(false);
    expect(status()).toBe('Opslaan lukt niet. Probeer het nog eens.');
  });

  it('when the reload after a failed save fails too there are no checkboxes but a retry', async () => {
    assign.mockImplementation(async () => {
      loadFails = true;
      throw new ProgressError('unavailable', 'test');
    });
    const { fixture, element, checkbox, status } = await render();
    checkbox('Roofvissen', 'Kind B')?.click();
    await fixture.whenStable();
    expect(element.querySelector('input')).toBeNull();
    expect(element.querySelector('.unavailable')).not.toBeNull();
    expect(status()).toBe('Opslaan lukt niet. Probeer het nog eens.');
  });

  it('all-children courses are one line without checkboxes', async () => {
    const { element } = await render();
    expect(textOf(element.querySelector('.all-children'))).toBe(
      'Voor alle kinderen: Blind typen, Proefcursus',
    );
    const legends = Array.from(element.querySelectorAll('legend')).map(textOf);
    expect(legends).not.toContain('Blind typen');
  });

  it('without selected-children courses there is only the line', async () => {
    const { element } = await render([blindTypen]);
    expect(element.querySelector('fieldset')).toBeNull();
    expect(element.querySelector('input')).toBeNull();
    expect(textOf(element.querySelector('.all-children'))).toBe('Voor alle kinderen: Blind typen');
    expect(loadAssignments).toHaveBeenCalled();
  });

  it('a load failure shows a retry and no checkboxes', async () => {
    loadFails = true;
    const { fixture, element, checkbox } = await render();
    expect(textOf(element.querySelector('.unavailable snf-ted-says'))).toBe(
      'Wie welke cursus ziet, kan ik nu niet ophalen.',
    );
    expect(element.querySelector('input')).toBeNull();
    expect(textOf(element.querySelector('.all-children'))).toBe(
      'Voor alle kinderen: Blind typen, Proefcursus',
    );

    loadFails = false;
    Array.from(element.querySelectorAll('button'))
      .find((button) => textOf(button) === 'Opnieuw')
      ?.click();
    await fixture.whenStable();
    expect(loadAssignments).toHaveBeenCalledTimes(2);
    expect(element.querySelector('.unavailable')).toBeNull();
    expect(checkbox('Roofvissen', 'Kind A')?.checked).toBe(true);
  });

  it('shows no checkboxes while the assignments load', async () => {
    loadAssignments.mockImplementation(() => new Promise(() => undefined));
    const fixture = TestBed.createComponent(CourseAccess);
    fixture.componentRef.setInput('courses', [roofvissen]);
    fixture.componentRef.setInput('children', [kindA]);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('input')).toBeNull();
    expect(textOf(element.querySelector('.loading'))).toBe('Even snuffelen…');
  });
});
