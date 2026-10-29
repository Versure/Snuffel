import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ManifestCourse } from '../../../core/content/content.types';
import type { CourseProgressSummary } from '../../../core/progress/course-progress';
import { CourseCard } from './course-card';

const proefcursus: ManifestCourse = {
  id: 'proefcursus',
  title: 'Proefcursus',
  kind: 'course',
  access: 'all-children',
  file: 'proefcursus/course.json',
  hash: '0123456789abcdef',
  lessons: [{ id: 'proefles-later', title: 'Later', status: 'planned' }],
  assets: [],
};

@Component({
  imports: [CourseCard],
  template: `<snf-course-card [course]="course" [progress]="progress()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly course = proefcursus;
  readonly progress = signal<CourseProgressSummary | null>({ completed: 1, total: 2 });
}

const textOf = (element: Element | null | undefined) =>
  (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

async function render(progress: CourseProgressSummary | null = { completed: 1, total: 2 }) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.progress.set(progress);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('CourseCard', () => {
  it('is one link to the course page', async () => {
    const { element } = await render();
    const links = element.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('/leren/proefcursus');
    // The whole card is inside the link.
    expect(links[0].querySelector('h3')).not.toBeNull();
    expect(links[0].querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it('shows the title as a heading', async () => {
    const { element } = await render();
    expect(textOf(element.querySelector('h3'))).toBe('Proefcursus');
  });

  it('shows how many lessons are completed of all lessons', async () => {
    const { element } = await render({ completed: 1, total: 2 });
    expect(textOf(element.querySelector('.label'))).toBe('1 van 2 lessen klaar');
    const bar = element.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('1');
    expect(bar?.getAttribute('aria-valuemax')).toBe('2');
  });

  it('names the bar after the course', async () => {
    const { element } = await render();
    expect(element.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).toBe(
      'Voortgang Proefcursus',
    );
  });

  it('says Alle lessen klaar when every lesson is completed', async () => {
    const { element } = await render({ completed: 3, total: 3 });
    expect(textOf(element.querySelector('.label'))).toBe('Alle lessen klaar!');
    expect(element.querySelector('[role="progressbar"]')?.getAttribute('aria-valuetext')).toBe(
      'Alle lessen klaar!',
    );
  });

  it('shows no bar without progress', async () => {
    const { element } = await render(null);
    expect(element.querySelector('[role="progressbar"]')).toBeNull();
    expect(textOf(element)).toBe('Proefcursus');
  });
});
