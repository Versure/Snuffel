import { TestBed } from '@angular/core/testing';
import type { QuizStep } from '../../../core/content/content.types';
import { QuizPreview } from './quiz-preview';

const step: QuizStep = {
  id: 'quiz',
  type: 'quiz',
  title: 'Quiz',
  intro: 'Vier situaties aan het **water**.',
  questions: [
    {
      id: 'eerste',
      prompt: 'Wat doe je?',
      options: [
        { id: 'a', text: 'Direct aanslaan', feedback: 'Klopt, er leeft iets.' },
        { id: 'b', text: 'Wachten', feedback: 'Dat werkt bij karper.' },
        { id: 'c', text: 'Lijn vieren', feedback: 'Met slappe lijn voel je niets.' },
      ],
      correctOptionId: 'b',
      hints: ['Denk aan de tijd.'],
      sourceRefs: [],
    },
    {
      id: 'tweede',
      prompt: 'Wat is het?',
      options: [
        { id: 'vast', text: 'Vast', feedback: 'Dood gewicht.' },
        { id: 'vis', text: 'Vis', feedback: 'Een vis schudt.' },
      ],
      correctOptionId: 'vast',
      hints: [],
      sourceRefs: [],
    },
  ],
};

const textOf = (element: Element | null): string =>
  (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('QuizPreview', () => {
  async function render(data: QuizStep = step): Promise<HTMLElement> {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(QuizPreview);
    fixture.componentRef.setInput('step', data);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows every question and option in content order', async () => {
    const element = await render();
    expect(textOf(element.querySelector('.intro'))).toBe('Vier situaties aan het water.');
    expect(textOf(element.querySelector('snf-speech-bubble'))).toBe(
      'Deze quiz kun je binnenkort echt maken.',
    );
    const questions = [...element.querySelectorAll('ol.questions > li')];
    expect(questions.map((question) => textOf(question.querySelector('.prompt')))).toEqual([
      'Wat doe je?',
      'Wat is het?',
    ]);
    expect([...questions[0].querySelectorAll('li.option')].map(textOf)).toEqual([
      'A. Direct aanslaan',
      'B. Wachten',
      'C. Lijn vieren',
    ]);
    expect([...questions[1].querySelectorAll('li.option')].map(textOf)).toEqual([
      'A. Vast',
      'B. Vis',
    ]);
  });

  it('shows no feedback, hints or correct answer', async () => {
    const element = await render();
    const text = textOf(element);
    for (const hidden of ['Klopt', 'karper', 'slappe lijn', 'Denk aan de tijd', 'Dood gewicht']) {
      expect(text).not.toContain(hidden);
    }
    // The correct option (b) looks exactly like the others.
    const options = [...element.querySelectorAll('li.option')].slice(0, 3);
    const classes = options.map((option) => option.className);
    expect(new Set(classes).size).toBe(1);
    expect(element.querySelector('[data-correct], .correct, .goed')).toBeNull();
  });

  it('has no buttons', async () => {
    const element = await render();
    expect(element.querySelector('button, input, [role="button"], [tabindex]')).toBeNull();
  });

  it('works without an intro', async () => {
    const element = await render({ ...step, intro: undefined });
    expect(element.querySelector('.intro')).toBeNull();
    expect(element.querySelectorAll('ol.questions > li')).toHaveLength(2);
  });
});
