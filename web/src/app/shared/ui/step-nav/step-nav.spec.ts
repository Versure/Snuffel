import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StepNav, type StepNavItem } from './step-nav';

@Component({
  imports: [StepNav],
  template: `<snf-step-nav
    [steps]="steps()"
    [done]="done()"
    (navigate)="navigated.push($event)"
  />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly steps = signal<readonly StepNavItem[]>([
    { id: 'uitleg', label: 'Uitleg' },
    { id: 'spel', label: 'Spel' },
    { id: 'quiz', label: 'Quiz' },
    { id: 'zelf-doen', label: 'Zelf doen' },
  ]);
  readonly done = signal<readonly string[]>([]);
  readonly navigated: string[] = [];
}

/** Text of an element without whitespace differences. */
const textOf = (element: Element): string =>
  (element.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('StepNav', () => {
  async function render() {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element, links: () => [...element.querySelectorAll('a')] };
  }

  it('renders a numbered link per step with the fragment', async () => {
    const { element, links } = await render();
    expect(element.querySelector('nav')?.getAttribute('aria-label')).toBe('Stappen van deze les');
    expect(element.querySelectorAll('nav ol > li')).toHaveLength(4);
    expect(links().map((link) => link.getAttribute('href'))).toEqual([
      '/#stap-uitleg',
      '/#stap-spel',
      '/#stap-quiz',
      '/#stap-zelf-doen',
    ]);
    expect(links().map((link) => link.querySelector('.number')?.textContent)).toEqual([
      '1',
      '2',
      '3',
      '4',
    ]);
    expect(links().map((link) => link.querySelector('.label')?.textContent)).toEqual([
      'Uitleg',
      'Spel',
      'Quiz',
      'Zelf doen',
    ]);
  });

  it('has the accessible name Stap N: label', async () => {
    const { links } = await render();
    expect(links().map(textOf)).toEqual([
      'Stap 1: Uitleg',
      'Stap 2: Spel',
      'Stap 3: Quiz',
      'Stap 4: Zelf doen',
    ]);
    // "Stap" and ":" are for screen readers only.
    for (const link of links()) {
      const hidden = [...link.querySelectorAll('.snf-visually-hidden')].map((span) =>
        span.textContent?.trim(),
      );
      expect(hidden).toEqual(['Stap', ':']);
    }
  });

  it('marks done steps', async () => {
    const { fixture, element, links } = await render();
    expect(element.querySelectorAll('li.done')).toHaveLength(0);
    fixture.componentInstance.done.set(['quiz']);
    await fixture.whenStable();
    const done = [...element.querySelectorAll('li.done')];
    expect(done).toHaveLength(1);
    expect(done[0].querySelector('.label')?.textContent).toBe('Quiz');
    expect(textOf(links()[2])).toBe('Stap 3: Quiz (klaar)');
  });

  it('emits navigate', async () => {
    const { fixture, links } = await render();
    links()[2].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.navigated).toEqual(['quiz']);
  });
});
