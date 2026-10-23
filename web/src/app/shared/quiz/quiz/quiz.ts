import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import type {
  LessonTed,
  QuizQuestion as QuizQuestionData,
  QuizStep,
} from '../../../core/content/content.types';
import { RANDOM } from '../../../core/random/random';
import { InlineText } from '../../inline-text/inline-text/inline-text';
import { LessonProgress } from '../../lesson-progress/lesson-progress';
import { Button } from '../../ui/button/button';
import { TedSays } from '../../ui/ted-says/ted-says';
import { QuizQuestion, type QuizAnswer } from '../quiz-question/quiz-question';
import { pick } from '../shuffle';

/**
 * The quiz of a lesson: every question below each other, one try per question per round, and
 * after the last question the score with Ted and a button "Opnieuw" for a new round. Answers go
 * to LessonProgress (one attempt each) and come back from it after a reload; without it the quiz
 * works in memory only.
 */
@Component({
  selector: 'snf-quiz',
  imports: [Button, InlineText, QuizQuestion, TedSays],
  templateUrl: './quiz.html',
  styleUrl: './quiz.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Quiz {
  private readonly progress = inject(LessonProgress, { optional: true });
  private readonly random = inject(RANDOM);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly step = input.required<QuizStep>();
  readonly ted = input.required<LessonTed>();

  protected readonly round = signal(0);

  /**
   * The answers of this round by question id. Filled from the stored attempts after every load
   * of the progress (not after every new attempt: an answer of this round that could not be
   * saved stays); empty again in a new round ("Opnieuw").
   */
  protected readonly answers = linkedSignal<
    { round: number; loads: number },
    ReadonlyMap<string, QuizAnswer>
  >({
    source: () => ({ round: this.round(), loads: this.progress?.loads() ?? 0 }),
    computation: (source, previous) => {
      if (previous && previous.source.round !== source.round) return new Map();
      return untracked(() => this.restored());
    },
  });

  protected readonly state = computed(() => this.progress?.state() ?? 'ready');
  protected readonly disabled = computed(() => this.state() !== 'ready');
  protected readonly error = computed(() => this.progress?.saveError(this.step().id) ?? null);

  protected readonly score = computed(() => {
    const questions = this.step().questions;
    const answers = this.answers();
    if (!questions.every((question) => answers.has(question.id))) return null;
    const right = questions.filter((question) => answers.get(question.id)?.correct).length;
    const all = right === questions.length;
    return {
      right,
      total: questions.length,
      all,
      line: all ? (pick(this.ted().correct, this.random) ?? '') : '',
    };
  });

  protected onAnswered(question: QuizQuestionData, answer: QuizAnswer): void {
    this.answers.update((answers) => new Map(answers).set(question.id, answer));
    void this.progress?.answer(
      this.step().id,
      question.id,
      answer.optionId,
      answer.correct,
      answer.hintsUsed,
      this.step().questions.map((item) => item.id),
    );
  }

  /** A new round: shuffled again and empty; the stored attempts stay. */
  protected restart(): void {
    this.round.update((round) => round + 1);
    afterNextRender(
      () =>
        this.host.nativeElement.querySelector<HTMLElement>('snf-quiz-question .prompt')?.focus(),
      { injector: this.injector },
    );
  }

  protected retry(): void {
    void this.progress?.reload();
  }

  /** The latest stored answer per question (same lesson version), checked against the content. */
  private restored(): ReadonlyMap<string, QuizAnswer> {
    const restored = new Map<string, QuizAnswer>();
    if (!this.progress) return restored;
    const questions = this.step().questions;
    const latest = this.progress.latestAnswers(questions.map((question) => question.id));
    for (const question of questions) {
      const attempt = latest.get(question.id);
      if (!attempt || !question.options.some((option) => option.id === attempt.option_id)) continue;
      restored.set(question.id, {
        optionId: attempt.option_id,
        correct: attempt.option_id === question.correctOptionId,
        hintsUsed: attempt.hints_used ?? 0,
      });
    }
    return restored;
  }
}
