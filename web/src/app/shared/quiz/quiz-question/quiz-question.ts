import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  viewChild,
  viewChildren,
} from '@angular/core';
import type {
  LessonTed,
  QuizOption,
  QuizQuestion as QuizQuestionData,
} from '../../../core/content/content.types';
import { RANDOM } from '../../../core/random/random';
import { InlineText } from '../../inline-text/inline-text/inline-text';
import { Button } from '../../ui/button/button';
import { TedSays } from '../../ui/ted-says/ted-says';
import { pick, shuffle } from '../shuffle';

/** An answer to one question: the chosen option, whether it is right, and the hints shown. */
export interface QuizAnswer {
  readonly optionId: string;
  readonly correct: boolean;
  readonly hintsUsed: number;
}

let nextId = 0;

/**
 * One quiz question: the prompt and its options as buttons, in a shuffled order per round. One
 * try per round: after a tap the options close, the chosen option turns green or red (and the
 * right one green), with "Jouw antwoord" and "Goede antwoord" as text, and Ted reacts with the
 * feedback of the chosen option. Hints on request, one by one, until the question is answered.
 */
@Component({
  selector: 'snf-quiz-question',
  imports: [Button, InlineText, TedSays],
  templateUrl: './quiz-question.html',
  styleUrl: './quiz-question.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizQuestion {
  private readonly random = inject(RANDOM);
  private readonly injector = inject(Injector);

  readonly question = input.required<QuizQuestionData>();
  readonly number = input.required<number>();
  /** The answer of this round (or a restored one); null while the question is open. */
  readonly answer = input<QuizAnswer | null>(null);
  readonly ted = input.required<LessonTed>();
  readonly disabled = input(false);
  /** A new round shuffles the options again. */
  readonly round = input(0);
  readonly answered = output<QuizAnswer>();

  private readonly feedback = viewChild<ElementRef<HTMLElement>>('feedback');
  private readonly hintItems = viewChildren<ElementRef<HTMLElement>>('hint');

  protected readonly promptId = `snf-quiz-vraag-${nextId++}`;

  /** The options in a new random order for every round. */
  protected readonly options = computed(() => {
    this.round();
    return shuffle(this.question().options, this.random);
  });

  /** How many hints are shown: back to none in a new round, or as many as a restored answer used. */
  protected readonly hintsShown = linkedSignal(() => {
    this.round();
    return Math.min(this.answer()?.hintsUsed ?? 0, this.question().hints.length);
  });
  protected readonly hints = computed(() => this.question().hints.slice(0, this.hintsShown()));
  protected readonly canAskHint = computed(
    () => !this.answer() && !this.disabled() && this.hintsShown() < this.question().hints.length,
  );

  protected readonly chosen = computed(() => {
    const answer = this.answer();
    return answer
      ? this.question().options.find((option) => option.id === answer.optionId)
      : undefined;
  });

  /** Ted's line for this answer, picked once per answer. */
  protected readonly tedLine = computed(() => {
    const answer = this.answer();
    if (!answer) return '';
    const ted = this.ted();
    return pick(answer.correct ? ted.correct : ted.incorrect, this.random) ?? '';
  });

  protected showHint(): void {
    this.hintsShown.update((count) => Math.min(count + 1, this.question().hints.length));
    if (this.canAskHint()) return;
    // The hint button closes after the last hint; the focus goes to that hint instead of the page.
    afterNextRender(() => this.hintItems().at(-1)?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  protected choose(option: QuizOption): void {
    if (this.answer() || this.disabled()) return;
    this.answered.emit({
      optionId: option.id,
      correct: option.id === this.question().correctOptionId,
      hintsUsed: this.hintsShown(),
    });
    // The tapped button closes; the focus goes to the feedback, which is read out anyway.
    afterNextRender(() => this.feedback()?.nativeElement.focus(), { injector: this.injector });
  }

  protected isRight(option: QuizOption): boolean {
    return option.id === this.question().correctOptionId;
  }
}
