import { TestBed } from '@angular/core/testing';
import { LessonProgress } from '../../../shared/lesson-progress/lesson-progress';
import lessonJson from '../../../../../../content/fixtures/courses/proefcursus/lessons/01-proefles.json';
import type { Lesson, LessonStep as LessonStepData } from '../../../core/content/content.types';
import { LessonStep } from './lesson-step';

const lesson = lessonJson as unknown as Lesson;
const steps = lesson.steps;
const stepOfType = (type: LessonStepData['type']): LessonStepData => {
  const found = steps.find((step) => step.type === type);
  if (!found) throw new Error(`no ${type} step`);
  return found;
};

describe('LessonStep', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function render(
    step: LessonStepData,
    number = 1,
    progress?: Partial<LessonProgress>,
  ): Promise<HTMLElement> {
    TestBed.resetTestingModule();
    if (progress) {
      TestBed.configureTestingModule({
        providers: [{ provide: LessonProgress, useValue: progress }],
      });
    }
    const fixture = TestBed.createComponent(LessonStep);
    fixture.componentRef.setInput('step', step);
    fixture.componentRef.setInput('number', number);
    fixture.componentRef.setInput('ted', lesson.ted);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders a section with an anchor and a numbered, focusable heading', async () => {
    const element = await render(stepOfType('quiz'), 3);
    const section = element.querySelector('section');
    expect(section?.id).toBe('stap-quiz');
    const heading = element.querySelector('h2');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect(heading?.getAttribute('tabindex')).toBe('-1');
    expect(heading?.querySelector('.number')?.textContent).toBe('3');
    expect(heading?.textContent?.replace(/\s+/g, ' ').trim()).toBe('3 Quiz');
  });

  it('renders every block of an explain step', async () => {
    const step = stepOfType('explain');
    const element = await render(step);
    expect(element.querySelectorAll('snf-block')).toHaveLength(
      step.type === 'explain' ? step.blocks.length : -1,
    );
  });

  it('renders the intro and a placeholder for an interaction step', async () => {
    const element = await render(stepOfType('interaction'), 2);
    expect(element.querySelector('.intro')?.textContent).toContain('Je ziet hoe hard');
    expect(element.querySelector('snf-interaction-placeholder')?.textContent).toContain(
      'Dit spel komt binnenkort.',
    );
  });

  it('a quiz step renders snf-quiz', async () => {
    const element = await render(stepOfType('quiz'), 3);
    expect(element.querySelector('snf-quiz')).not.toBeNull();
    expect(element.querySelectorAll('snf-quiz ol.questions > li snf-quiz-question')).toHaveLength(
      4,
    );
    expect(element.querySelectorAll('snf-quiz button.option')).toHaveLength(16);
  });

  it('a practice step renders snf-checklist', async () => {
    const element = await render(stepOfType('practice'), 4);
    expect(element.querySelector('snf-checklist')).not.toBeNull();
    expect(
      element.querySelectorAll('snf-checklist ul.items > li input[type="checkbox"]'),
    ).toHaveLength(4);
  });
  it('reaching the end of an explain step marks it completed', async () => {
    let seen: IntersectionObserverCallback = () => undefined;
    const observed: Element[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          seen = callback;
        }
        observe(element: Element) {
          observed.push(element);
        }
        disconnect() {
          // Nothing to clean up.
        }
      },
    );
    const markStep = vi.fn(async () => undefined);
    const element = await render(stepOfType('explain'), 1, { markStep });
    // The marker comes after the last block.
    const marker = element.querySelector('section > .end-marker');
    expect(observed).toEqual([marker]);
    expect(marker?.previousElementSibling?.tagName.toLowerCase()).toBe('snf-block');
    expect(marker?.getAttribute('aria-hidden')).toBe('true');
    expect(markStep).not.toHaveBeenCalled();

    seen(
      [{ isIntersecting: true, target: marker } as unknown as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    expect(markStep).toHaveBeenCalledWith('uitleg', 'completed');
  });

  it('only an explain step has the end marker', async () => {
    for (const type of ['interaction', 'quiz', 'practice'] as const) {
      const element = await render(stepOfType(type));
      expect(element.querySelector('.end-marker'), type).toBeNull();
    }
  });
});
