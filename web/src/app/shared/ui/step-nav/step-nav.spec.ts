import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StepNav, type StepNavItem } from './step-nav';

@Component({
  imports: [StepNav],
  template: `<snf-step-nav
    [steps]="steps()"
    [done]="done()"
    [started]="started()"
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
  readonly started = signal<readonly string[]>([]);
  readonly navigated: string[] = [];
}

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
    // The name comes from one visually hidden text; the circle and the label are hidden from
    // screen readers, so nothing is read twice.
    expect(
      links().map((link) => link.querySelector('.snf-visually-hidden')?.textContent?.trim()),
    ).toEqual(['Stap 1: Uitleg', 'Stap 2: Spel', 'Stap 3: Quiz', 'Stap 4: Zelf doen']);
    for (const link of links()) {
      expect(link.querySelector('.number')?.getAttribute('aria-hidden')).toBe('true');
      expect(link.querySelector('.label')?.getAttribute('aria-hidden')).toBe('true');
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
    expect(links()[2].querySelector('.snf-visually-hidden')?.textContent?.trim()).toBe(
      'Stap 3: Quiz (klaar)',
    );
  });

  it('shows done and started steps with a visible status, not only a colour', async () => {
    const { fixture, element, links } = await render();
    expect(element.querySelectorAll('.status')).toHaveLength(0);
    fixture.componentInstance.done.set(['uitleg', 'spel']);
    // A step in both lists counts as done.
    fixture.componentInstance.started.set(['spel', 'quiz']);
    await fixture.whenStable();
    expect([...element.querySelectorAll('li')].map((item) => item.className.trim())).toEqual([
      'done',
      'done',
      'started',
      '',
    ]);
    expect(links().map((link) => link.querySelector('.status')?.textContent ?? null)).toEqual([
      'klaar ✓',
      'klaar ✓',
      'bezig',
      null,
    ]);
    expect(links()[2].querySelector('.status')?.getAttribute('aria-hidden')).toBe('true');
    expect(
      links().map((link) => link.querySelector('.snf-visually-hidden')?.textContent?.trim()),
    ).toEqual([
      'Stap 1: Uitleg (klaar)',
      'Stap 2: Spel (klaar)',
      'Stap 3: Quiz (bezig)',
      'Stap 4: Zelf doen',
    ]);
  });

  it('emits navigate', async () => {
    const { fixture, links } = await render();
    links()[2].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.navigated).toEqual(['quiz']);
  });

  it('does not emit navigate for a click with a modifier key or another button', async () => {
    const { fixture, element, links } = await render();
    // The test only checks the output; the browser default (a new tab) is not wanted here.
    element.addEventListener('click', (event) => event.preventDefault());
    const clicks: MouseEventInit[] = [
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
    ];
    for (const init of clicks) {
      links()[1].dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, ...init }),
      );
    }
    await fixture.whenStable();
    expect(fixture.componentInstance.navigated).toEqual([]);

    links()[1].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.navigated).toEqual(['spel']);
  });
});
