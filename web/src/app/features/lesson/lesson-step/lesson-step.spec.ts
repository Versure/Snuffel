import { TestBed } from '@angular/core/testing';
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
  async function render(step: LessonStepData, number = 1): Promise<HTMLElement> {
    TestBed.resetTestingModule();
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
});
