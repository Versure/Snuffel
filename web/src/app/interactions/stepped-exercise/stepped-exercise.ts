import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
} from '@angular/core';
import type {
  ChoiceOption,
  Exercise,
  ExerciseStep,
  LessonTed,
  SteppedExerciseConfig,
} from '../../core/content/content.types';
import { RANDOM } from '../../core/random/random';
import { Fraction } from '../../shared/inline-text/fraction/fraction';
import { hasFraction } from '../../shared/inline-text/inline-markup';
import { InlineText } from '../../shared/inline-text/inline-text/inline-text';
import { pick, shuffle } from '../../shared/quiz/shuffle';
import { Button } from '../../shared/ui/button/button';
import { Card } from '../../shared/ui/card/card';
import { ProgressBar } from '../../shared/ui/progress-bar/progress-bar';
import { TedSays } from '../../shared/ui/ted-says/ted-says';
import type { TedMood } from '../../shared/ui/ted/ted';
import type { InteractionComponent, InteractionResult } from '../interaction';
import { checkAnswer, readFraction } from './answer';
import {
  afterAnswer,
  afterHint,
  afterSolution,
  afterStepOpened,
  type ExerciseProgress,
  isAttempt,
  isFinished,
  NO_PROGRESS,
  seriesResult,
  solutionAvailable,
} from './exercise-progress';

export const EXERCISE_TEXT = {
  check: 'Controleer',
  empty: 'Vul eerst een antwoord in.',
  unreadable: 'Dat kan ik niet lezen als getal. Schrijf bijvoorbeeld 0,75 of 3/4.',
  tryAgain: 'Probeer het nog eens, of vraag een hint.',
  hint: 'Hint',
  nextHint: 'Nog een hint',
  solution: 'Bekijk de uitwerking',
  solutionTitle: 'Uitwerking',
  solutionLater:
    'De uitwerking kun je zien als je het zelf geprobeerd hebt en alle hints hebt bekeken.',
  next: 'Volgende opgave',
  done: 'Klaar',
  again: 'Nog een keer',
  mine: 'Jouw antwoord',
  finishedTitle: 'Klaar!',
  finishedRetry: 'Kijk de uitwerkingen nog eens rustig na. Morgen gaat het nog beter.',
  reading: 'Zo lees ik jouw antwoord:',
  progressName: 'Opgaven',
  progress: (done: number, total: number) => `${done} van ${total} opgaven klaar`,
  remaining: (count: number) =>
    count === 1 ? 'Er komt nog 1 opgave.' : `Er komen nog ${count} opgaven.`,
} as const;

/** What Ted says: his mood and the parts of his text (lesson text with inline markup). */
interface TedLine {
  readonly mood: TedMood;
  readonly parts: readonly string[];
}

/** Every text of an exercise that the child sees (not what the child types). */
function exerciseTexts(exercise: Exercise): string[] {
  return [
    exercise.prompt,
    ...exercise.hints,
    ...exercise.steps.flatMap((step) => [step.title, step.text]),
    ...exercise.commonMistakes.map((mistake) => mistake.feedback),
    exercise.workedSolution,
    ...(exercise.answer.type === 'choice' ? exercise.answer.options.map((item) => item.text) : []),
  ];
}

/** The message under the input when an answer is no attempt. */
type Notice = 'empty' | 'unreadable';

let nextId = 0;

/**
 * A homework exercise (`stepped-exercise`): the exercises one at a time, each with an own answer
 * (typed, or one of the options), unlimited tries, hints on request one by one, steps the child
 * opens on its own, and the worked solution after an own attempt and all hints (or after a
 * right answer). Ted reacts to a right answer, a known mistake (with its feedback) and another
 * wrong answer. Emits `answered` at the first readable answer of a series and `completed` with
 * the number of exercises that were right on their own after the last exercise.
 */
@Component({
  selector: 'snf-stepped-exercise',
  imports: [Button, Card, Fraction, InlineText, ProgressBar, TedSays],
  templateUrl: './stepped-exercise.html',
  styleUrl: './stepped-exercise.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SteppedExercise implements InteractionComponent<SteppedExerciseConfig> {
  private readonly random = inject(RANDOM);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly config = input.required<SteppedExerciseConfig>();
  readonly ted = input.required<LessonTed>();
  readonly answered = output<void>();
  readonly completed = output<InteractionResult>();

  protected readonly text = EXERCISE_TEXT;
  private readonly baseId = `snf-oefening-${nextId++}`;
  protected readonly headingId = `${this.baseId}-kop`;
  protected readonly promptId = `${this.baseId}-opgave`;
  protected readonly unitId = `${this.baseId}-eenheid`;
  protected readonly noticeId = `${this.baseId}-melding`;
  protected readonly readingId = `${this.baseId}-lezing`;

  /** A new series shuffles the options again. */
  private readonly series = signal(0);
  protected readonly index = signal(0);
  private readonly progresses = signal<readonly ExerciseProgress[]>([]);
  /** True on the end screen, after the last exercise. */
  protected readonly finished = signal(false);
  /** What is in the input now. */
  protected readonly typed = signal('');
  protected readonly notice = signal<Notice | null>(null);
  /** Ted's reaction to the last answer of this exercise. */
  protected readonly reaction = signal<TedLine | null>(null);
  /** The wrong options the child chose in this exercise. */
  protected readonly wrongChoices = signal<ReadonlySet<string>>(new Set());
  /** The steps of this exercise that are open now. */
  protected readonly openSteps = signal<ReadonlySet<string>>(new Set());
  private answeredThisSeries = false;

  protected readonly exercises = computed(() => this.config().exercises);
  protected readonly total = computed(() => this.exercises().length);
  protected readonly exercise = computed<Exercise | undefined>(
    () => this.exercises()[this.index()],
  );
  protected readonly progress = computed(() => this.progresses()[this.index()] ?? NO_PROGRESS);
  protected readonly isLast = computed(() => this.index() + 1 >= this.total());
  /** Exercises of this series that are done: shown in a bar, so no exercise is overlooked. */
  protected readonly finishedCount = computed(
    () => this.progresses().filter((progress) => isFinished(progress)).length,
  );
  /** Exercises after this one. */
  protected readonly remaining = computed(() => Math.max(0, this.total() - this.index() - 1));

  /** The options of every choice exercise, in a new random order per series. */
  private readonly shuffled = computed(() => {
    this.series();
    return this.exercises().map((exercise) =>
      exercise.answer.type === 'choice' ? shuffle(exercise.answer.options, this.random) : [],
    );
  });
  protected readonly options = computed(() => this.shuffled()[this.index()] ?? []);

  protected readonly unit = computed(() => {
    const answer = this.exercise()?.answer;
    return answer?.type === 'number' ? answer.unit : undefined;
  });

  /**
   * True when the exercise writes fractions stacked: a valid `{{a/b}}` in any text of any of its
   * exercises. Derived, not a field in the content (plan M14, question 4).
   */
  protected readonly usesStackedNotation = computed(() =>
    this.exercises().some((exercise) => exerciseTexts(exercise).some(hasFraction)),
  );

  /** How the app reads the typed answer as a fraction, shown stacked under the input. */
  protected readonly reading = computed(() => {
    const exercise = this.exercise();
    if (!exercise || !this.usesStackedNotation()) return null;
    return readFraction(exercise.answer, this.typed());
  });

  protected readonly describedBy = computed(() => {
    const ids = [
      this.unit() ? this.unitId : '',
      this.reading() ? this.readingId : '',
      this.notice() ? this.noticeId : '',
    ];
    return ids.filter(Boolean).join(' ') || null;
  });

  protected readonly noticeText = computed(() => {
    const notice = this.notice();
    return notice ? EXERCISE_TEXT[notice] : '';
  });

  protected readonly hints = computed(
    () => this.exercise()?.hints.slice(0, this.progress().hintsShown) ?? [],
  );
  protected readonly canAskHint = computed(
    () =>
      !this.progress().correct && this.progress().hintsShown < (this.exercise()?.hints.length ?? 0),
  );
  protected readonly canSeeSolution = computed(() => {
    const exercise = this.exercise();
    return !!exercise && solutionAvailable(this.progress(), exercise);
  });
  protected readonly exerciseDone = computed(() => isFinished(this.progress()));

  protected readonly score = computed(
    () => this.progresses().filter((progress) => progress.correctBeforeSolution).length,
  );
  /** Ted on the end screen. */
  protected readonly endLine = signal<TedLine>({ mood: 'happy', parts: [] });

  constructor() {
    this.reset();
  }

  protected onInput(event: Event): void {
    this.typed.set((event.target as HTMLInputElement).value);
    this.notice.set(null);
  }

  /** Controleer, or Enter in the input. */
  protected submit(event: Event): void {
    event.preventDefault();
    this.answer(this.typed());
  }

  protected choose(option: ChoiceOption): void {
    if (this.progress().correct || this.wrongChoices().has(option.id)) return;
    this.answer(option.id);
  }

  protected isWrongChoice(option: ChoiceOption): boolean {
    return this.wrongChoices().has(option.id);
  }

  protected isRightChoice(option: ChoiceOption): boolean {
    const answer = this.exercise()?.answer;
    return this.progress().correct && answer?.type === 'choice'
      ? answer.correctOptionId === option.id
      : false;
  }

  protected showHint(): void {
    const exercise = this.exercise();
    if (!exercise || !this.canAskHint()) return;
    this.updateProgress((progress) => afterHint(progress, exercise));
    if (this.canAskHint()) return;
    // The hint button closes after the last hint; the focus goes to that hint.
    this.focusAfterRender('.hint:last-child');
  }

  protected isOpen(step: ExerciseStep): boolean {
    return this.openSteps().has(step.id);
  }

  protected stepTextId(step: ExerciseStep): string {
    return `${this.baseId}-${this.index()}-${step.id}`;
  }

  protected toggleStep(step: ExerciseStep): void {
    const open = new Set(this.openSteps());
    if (open.has(step.id)) {
      open.delete(step.id);
    } else {
      open.add(step.id);
      this.updateProgress((progress) => afterStepOpened(progress, step.id));
    }
    this.openSteps.set(open);
  }

  protected showSolution(): void {
    if (!this.canSeeSolution()) return;
    this.updateProgress(afterSolution);
    this.focusAfterRender('.solution');
  }

  /** Volgende opgave, or Klaar after the last exercise. */
  protected next(): void {
    if (!this.exerciseDone()) return;
    if (this.isLast()) {
      this.finish();
      return;
    }
    this.index.update((index) => index + 1);
    this.clearExercise();
    this.focusAfterRender('.heading');
  }

  /** Nog een keer: a new series from the first exercise. */
  protected again(): void {
    this.reset();
    this.series.update((series) => series + 1);
    this.focusAfterRender('.heading');
  }

  private answer(input: string): void {
    const exercise = this.exercise();
    if (!exercise || this.progress().correct) return;
    const { outcome, feedback } = checkAnswer(exercise.answer, input, exercise.commonMistakes);
    if (!isAttempt(outcome)) {
      this.showNotice(outcome === 'unreadable' ? 'unreadable' : 'empty');
      return;
    }
    this.notice.set(null);
    this.updateProgress((progress) => afterAnswer(progress, outcome));
    if (exercise.answer.type === 'choice' && outcome !== 'correct') {
      this.wrongChoices.update((chosen) => new Set([...chosen, input]));
    }
    const ted = this.ted();
    if (outcome === 'correct') {
      this.reaction.set({ mood: 'happy', parts: [pick(ted.correct, this.random) ?? ''] });
    } else if (outcome === 'mistake') {
      this.reaction.set({ mood: 'thinking', parts: [feedback ?? ''] });
    } else {
      this.reaction.set({
        mood: 'oops',
        parts: [pick(ted.incorrect, this.random) ?? '', EXERCISE_TEXT.tryAgain],
      });
    }
    if (!this.answeredThisSeries) {
      this.answeredThisSeries = true;
      this.answered.emit();
    }
    this.focusAfterRender('.say');
  }

  /**
   * Shows why an answer is no attempt and puts the focus in the input (also after a tap on
   * Controleer), so a screen reader reads the message through aria-describedby and aria-invalid.
   */
  private showNotice(notice: Notice): void {
    const selector = 'input.input';
    if (this.notice() === notice) {
      // Nothing changes on the screen, so there is no next render: focus at once.
      this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus();
      return;
    }
    this.notice.set(notice);
    this.focusAfterRender(selector);
  }

  private finish(): void {
    const result = seriesResult(this.exercises(), this.progresses());
    const allRight = result.score === result.total;
    const line = `${result.score} van ${result.total} zelf goed.`;
    this.endLine.set(
      allRight
        ? { mood: 'cool', parts: [line, pick(this.ted().correct, this.random) ?? ''] }
        : { mood: 'happy', parts: [line, EXERCISE_TEXT.finishedRetry] },
    );
    this.finished.set(true);
    this.completed.emit(result);
    this.focusAfterRender('.say');
  }

  private reset(): void {
    this.index.set(0);
    this.finished.set(false);
    this.answeredThisSeries = false;
    this.progresses.set([]);
    this.clearExercise();
  }

  private clearExercise(): void {
    this.typed.set('');
    this.notice.set(null);
    this.reaction.set(null);
    this.wrongChoices.set(new Set());
    this.openSteps.set(new Set());
  }

  private updateProgress(change: (progress: ExerciseProgress) => ExerciseProgress): void {
    const index = this.index();
    this.progresses.update((list) => {
      const next = [...list];
      while (next.length <= index) next.push(NO_PROGRESS);
      next[index] = change(next[index] ?? NO_PROGRESS);
      return next;
    });
  }

  /** Moves the focus after the next render, so it never stays on a button that is gone. */
  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
