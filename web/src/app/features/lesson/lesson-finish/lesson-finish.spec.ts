import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LessonContext } from '../../../shared/lesson-context/lesson-context';
import { LESSON_FINISH_TEXT, LessonFinish, type LessonFinishStep } from './lesson-finish';

const steps: LessonFinishStep[] = [
  { id: 'uitleg', label: 'Uitleg', title: 'Zo werkt het' },
  { id: 'oefenen', label: 'Oefenen', title: 'Breuken **oefenen**' },
  { id: 'quiz', label: 'Quiz', title: 'Quiz' },
];

const textOf = (element: Element | null | undefined): string =>
  (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('LessonFinish', () => {
  async function render(inputs: { done?: string[]; started?: string[]; known?: boolean }): Promise<{
    fixture: ComponentFixture<LessonFinish>;
    element: HTMLElement;
    navigated: string[];
  }> {
    TestBed.configureTestingModule({ providers: [provideRouter([]), LessonContext] });
    const fixture = TestBed.createComponent(LessonFinish);
    fixture.componentRef.setInput('steps', steps);
    fixture.componentRef.setInput('done', inputs.done ?? []);
    fixture.componentRef.setInput('started', inputs.started ?? []);
    fixture.componentRef.setInput('known', inputs.known ?? true);
    fixture.componentRef.setInput('finished', 'Goed gedaan!');
    const navigated: string[] = [];
    fixture.componentInstance.navigate.subscribe((id) => navigated.push(id));
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement, navigated };
  }

  it('lists the steps that are not done, with a link and their status', async () => {
    const { element } = await render({ done: ['uitleg'], started: ['oefenen'] });
    expect(textOf(element.querySelector('snf-speech-bubble'))).toBe('Goed gedaan!');
    expect(textOf(element.querySelector('.not-yet-title'))).toBe(LESSON_FINISH_TEXT.notYet);
    const links = [...element.querySelectorAll('a.open-step')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/#stap-oefenen',
      '/#stap-quiz',
    ]);
    expect(links.map(textOf)).toEqual([
      '2Stap 2: Oefenen: Breuken oefenen, bezig',
      '3Stap 3: Quiz: Quiz, nog niet begonnen',
    ]);
    expect(links.map((link) => link.classList.contains('started'))).toEqual([true, false]);
    expect(links[0].querySelector('.number')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('says only the finished line when every step is done', async () => {
    const { element } = await render({ done: ['uitleg', 'oefenen', 'quiz'] });
    expect(element.querySelector('.not-yet')).toBeNull();
    expect(textOf(element.querySelector('snf-speech-bubble'))).toBe('Goed gedaan!');
  });

  it('says only the finished line while the progress is not known', async () => {
    const { element } = await render({ known: false });
    expect(element.querySelector('.not-yet')).toBeNull();
    expect(textOf(element.querySelector('snf-speech-bubble'))).toBe('Goed gedaan!');
  });

  it('emits navigate for a plain click only', async () => {
    const { fixture, element, navigated } = await render({});
    element.addEventListener('click', (event) => event.preventDefault());
    const links = [...element.querySelectorAll<HTMLAnchorElement>('a.open-step')];
    links[1].dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }),
    );
    links[1].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(navigated).toEqual(['oefenen']);
  });
});
