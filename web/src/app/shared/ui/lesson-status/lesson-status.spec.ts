import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { LessonStatus } from '../../../core/progress/course-progress';
import { LessonStatusLabel } from './lesson-status';

@Component({
  imports: [LessonStatusLabel],
  template: `<snf-lesson-status [status]="status()" [done]="2" [total]="4" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly status = signal<LessonStatus>('new');
}

const textOf = (element: Element | null | undefined) =>
  (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

async function render(status: LessonStatus) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.status.set(status);
  await fixture.whenStable();
  return (fixture.nativeElement as HTMLElement).querySelector('.label');
}

describe('LessonStatusLabel', () => {
  it('completed says Klaar with a hidden check mark', async () => {
    const label = await render('completed');
    expect(textOf(label)).toBe('Klaar ✓');
    expect(label?.classList).toContain('label--completed');
    // The check mark is a sign next to the word, not the only sign.
    expect(label?.querySelector('[aria-hidden="true"]')?.textContent).toBe('✓');
  });

  it('started says how many steps are completed', async () => {
    const label = await render('started');
    expect(textOf(label)).toBe('Bezig: 2 van 4 stappen klaar');
    expect(label?.classList).toContain('label--started');
  });

  it('new says Nieuw', async () => {
    const label = await render('new');
    expect(textOf(label)).toBe('Nieuw');
    expect(label?.classList).toContain('label--new');
  });

  it('planned says Komt nog', async () => {
    const label = await render('planned');
    expect(textOf(label)).toBe('Komt nog');
    expect(label?.classList).toContain('label--planned');
  });
});
