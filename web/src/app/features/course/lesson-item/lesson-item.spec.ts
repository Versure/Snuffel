import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ManifestLesson } from '../../../core/content/content.types';
import type { LessonProgressSummary } from '../../../core/progress/course-progress';
import { LessonItem } from './lesson-item';

const published: ManifestLesson = {
  id: 'proefles',
  title: 'Proefles: aanbeet of vastzitten?',
  status: 'published',
  version: 1,
  estimatedMinutes: 11,
  file: 'proefcursus/lessons/proefles.json',
  hash: '0123456789abcdef',
  stepIds: ['uitleg', 'spel', 'quiz', 'zelf-doen'],
};

const planned: ManifestLesson = {
  id: 'proefles-later',
  title: 'Proefles: een les die nog komt',
  status: 'planned',
};

@Component({
  imports: [LessonItem],
  template: `<snf-lesson-item
    courseId="proefcursus"
    [lesson]="lesson()"
    [number]="2"
    [progress]="progress()"
  />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly lesson = signal<ManifestLesson>(published);
  readonly progress = signal<LessonProgressSummary | null>(null);
}

const textOf = (element: Element | null | undefined) =>
  (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

async function render(lesson: ManifestLesson, progress: LessonProgressSummary | null) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.lesson.set(lesson);
  fixture.componentInstance.progress.set(progress);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  return { element, label: element.querySelector('.label') };
}

describe('LessonItem', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('a published lesson is a link to the lesson', async () => {
    const { element } = await render(published, { status: 'new', done: 0, total: 4 });
    const link = element.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/leren/proefcursus/proefles');
    expect(textOf(link)).toBe('Proefles: aanbeet of vastzitten?');
    expect(textOf(element.querySelector('.number'))).toBe('2');
  });

  it('a screen reader hears the lesson number once, as Les 2', async () => {
    const { element } = await render(published, null);
    // The big number is decoration; the hidden text says what it is.
    expect(element.querySelector('.number')?.getAttribute('aria-hidden')).toBe('true');
    expect(textOf(element.querySelector('.snf-visually-hidden'))).toBe('Les 2');
    // The link keeps the title as its name.
    expect(textOf(element.querySelector('a'))).toBe('Proefles: aanbeet of vastzitten?');
  });

  it('a planned lesson is no link and says Komt nog', async () => {
    const { element, label } = await render(planned, { status: 'planned', done: 0, total: 0 });
    expect(element.querySelector('a')).toBeNull();
    expect(textOf(element.querySelector('.title'))).toBe('Proefles: een les die nog komt');
    expect(textOf(label)).toBe('Komt nog');
    expect(element.querySelector('.minutes')).toBeNull();
  });

  it('shows the estimated minutes', async () => {
    const { element } = await render(published, null);
    expect(textOf(element.querySelector('.minutes'))).toBe('Ongeveer 11 minuten');
  });

  it('a completed lesson says Klaar with a check mark', async () => {
    const { label } = await render(published, { status: 'completed', done: 4, total: 4 });
    expect(textOf(label)).toBe('Klaar ✓');
    expect(label?.classList).toContain('label--completed');
    // The check mark is a sign next to the word, not the only sign.
    expect(label?.querySelector('[aria-hidden="true"]')?.textContent).toBe('✓');
  });

  it('a started lesson says how many steps are completed', async () => {
    const { label } = await render(published, { status: 'started', done: 2, total: 4 });
    expect(textOf(label)).toBe('Bezig: 2 van 4 stappen klaar');
  });

  it('a new lesson says Nieuw', async () => {
    const { label } = await render(published, { status: 'new', done: 0, total: 4 });
    expect(textOf(label)).toBe('Nieuw');
  });

  it('shows no label without progress', async () => {
    const { element } = await render(published, null);
    expect(element.querySelector('.label')).toBeNull();
    // A planned lesson does not depend on progress: it still says Komt nog.
    const plannedItem = await render(planned, null);
    expect(textOf(plannedItem.label)).toBe('Komt nog');
  });
});
