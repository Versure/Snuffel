import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { UserRecord } from '../../../core/pocketbase/types';
import { ChildCard, type ChildCardActivity } from './child-card';

const kindA: UserRecord = { id: 'a1', name: 'Kind A', username: 'kind-a', role: 'child' };
const now = new Date(2026, 9, 23, 16, 0);

@Component({
  imports: [ChildCard],
  template: `<snf-child-card [child]="child" [activity]="activity()" [now]="now" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly child = kindA;
  readonly now = now;
  readonly activity = signal<ChildCardActivity | null>(null);
}

const textOf = (element: Element | null | undefined) =>
  (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

async function render(activity: ChildCardActivity | null) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.activity.set(activity);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const today = new Date(2026, 9, 23, 14, 5).toISOString();

describe('ChildCard', () => {
  it('is one link to the page of the child', async () => {
    const element = await render({ lessonsCompleted: 1, lastActivity: today });
    const links = element.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('/ouder/a1');
    expect(links[0].querySelector('h2')).not.toBeNull();
    expect(links[0].querySelector('.last-activity')).not.toBeNull();
  });

  it('shows the name as a heading', async () => {
    const element = await render(null);
    expect(textOf(element.querySelector('h2'))).toBe('Kind A');
  });

  it('shows the last activity', async () => {
    const element = await render({ lessonsCompleted: 0, lastActivity: today });
    expect(textOf(element.querySelector('.last-activity'))).toBe('Laatst actief: vandaag om 14:05');
  });

  it('says Nog niet actief without activity', async () => {
    const element = await render({ lessonsCompleted: 0, lastActivity: null });
    expect(textOf(element.querySelector('.last-activity'))).toBe('Nog niet actief');
  });

  it('shows how many lessons are completed', async () => {
    const element = await render({ lessonsCompleted: 2, lastActivity: today });
    expect(textOf(element.querySelector('.lessons-completed'))).toBe('2 lessen klaar');
  });

  it('shows no numbers without activity', async () => {
    const element = await render(null);
    expect(textOf(element)).toBe('Kind A');
  });
});
