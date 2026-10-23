import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
} from '@angular/core';
import type {
  LessonTed,
  ShapePart,
  TraceChoice,
  TraceGameConfig,
  TracePattern,
} from '../../core/content/content.types';
import { ANIMATION_FRAMES, REDUCED_MOTION } from '../../core/motion/motion';
import { RANDOM } from '../../core/random/random';
import { InlineText } from '../../shared/inline-text/inline-text/inline-text';
import { pick } from '../../shared/quiz/shuffle';
import { Button } from '../../shared/ui/button/button';
import { TedSays } from '../../shared/ui/ted-says/ted-says';
import type { TedMood } from '../../shared/ui/ted/ted';
import type { InteractionComponent, InteractionResult } from '../interaction';
import { lineTip, rodPath, tracePoints, VIEW_BOX } from './geometry';
import { makeRounds } from './rounds';
import { shapeValue } from './shape';

/** Where a game is: before Start, in a round (drawing or choosing), answered, or finished. */
export type TraceGamePhase = 'idle' | 'round' | 'answered' | 'finished';

/** One answered round, as stored in `detail.rounds`. */
export interface TraceRound {
  readonly pattern: string;
  readonly choice: string;
  readonly correct: boolean;
}

/** What Ted says: his mood and the parts of his text (lesson text with inline markup). */
interface TedLine {
  readonly mood: TedMood;
  readonly parts: readonly string[];
}

export const TRACE_TEXT = {
  idle: 'Tik op ‘Start’. Kijk naar de gele lijn en de hengeltop, en kies dan wat je voelt.',
  drawing: 'Voel mee… wat gebeurt er aan je lijn?',
  choose: 'Wat was het?',
  finishedGood: 'Jij voelt het verschil al!',
  finishedRetry: 'Speel nog een keer, dan voel je het verschil steeds beter.',
} as const;

/** The smallest end of the line while drawing, so the first frame already has a point. */
const MIN_END = 0.001;

/**
 * The trace game (`trace-game`, "voel-spel"), as in the reference lesson but fully from the
 * content: per round a line draws itself over `durationMs` while the rod tip bends with it,
 * then the child chooses what it felt and Ted reacts with a line from the lesson and the
 * explanation of the pattern. With reduced motion the line is there at once. Emits `answered`
 * at the first answer of a game and `completed` after the last round.
 */
@Component({
  selector: 'snf-trace-game',
  imports: [Button, InlineText, TedSays],
  templateUrl: './trace-game.html',
  styleUrl: './trace-game.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TraceGame implements InteractionComponent<TraceGameConfig> {
  private readonly random = inject(RANDOM);
  private readonly frames = inject(ANIMATION_FRAMES);
  private readonly reducedMotion = inject(REDUCED_MOTION);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly config = input.required<TraceGameConfig>();
  readonly ted = input.required<LessonTed>();
  readonly answered = output<void>();
  readonly completed = output<InteractionResult>();

  protected readonly viewBox = VIEW_BOX;
  protected readonly phase = signal<TraceGamePhase>('idle');
  /** The pattern ids of this game, in order. */
  protected readonly rounds = signal<readonly string[]>([]);
  protected readonly index = signal(0);
  /** The answered rounds of this game. */
  protected readonly answers = signal<readonly TraceRound[]>([]);
  /** The choice of the current round, or null before an answer. */
  protected readonly chosen = signal<string | null>(null);
  /** True while a line draws itself. */
  protected readonly drawing = signal(false);
  /** The pattern on the screen (null before the first Start) and how far it is drawn (0-1). */
  protected readonly shown = signal<string | null>(null);
  protected readonly end = signal(1);
  /** True once the line of this round has been drawn completely (then "Bekijk nog eens" shows). */
  protected readonly roundDrawn = signal(false);
  private readonly line = signal<TedLine>({ mood: 'cool', parts: [TRACE_TEXT.idle] });

  private frame: number | null = null;
  private answeredThisGame = false;

  private readonly patterns = computed(
    () => new Map(this.config().patterns.map((pattern) => [pattern.id, pattern])),
  );

  protected readonly choices = computed(() => this.config().choices);
  protected readonly total = computed(() => this.rounds().length || this.config().rounds);
  protected readonly score = computed(() => this.answers().filter((item) => item.correct).length);
  protected readonly choicesOpen = computed(() => this.phase() === 'round' && !this.drawing());
  protected readonly tedLine = this.line.asReadonly();

  protected readonly heading = computed(() => {
    switch (this.phase()) {
      case 'idle':
        return `${this.config().rounds} rondes`;
      case 'finished':
        return `${this.score()} van ${this.total()} goed`;
      default:
        return `Ronde ${this.index() + 1} van ${this.total()}`;
    }
  });

  /** The shape on the screen: the shown pattern, or a flat line at rest. */
  private readonly shape = computed<readonly ShapePart[]>(() => {
    const shown = this.shown();
    const pattern = shown ? this.patterns().get(shown) : undefined;
    if (pattern) return pattern.shape;
    const first = this.config().patterns[0];
    return [{ type: 'base', level: first ? shapeValue(first.shape, 0) : 0 }];
  });

  protected readonly points = computed(() => tracePoints(this.shape(), this.end()));
  private readonly pull = computed(() => shapeValue(this.shape(), this.end()));
  protected readonly rod = computed(() => rodPath(this.pull()));
  protected readonly tip = computed(() => lineTip(this.pull()));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Start and Nog een potje: new rounds, from the first. */
  protected start(): void {
    const config = this.config();
    this.rounds.set(
      makeRounds(
        config.patterns.map((pattern) => pattern.id),
        config.rounds,
        this.random,
      ),
    );
    this.answers.set([]);
    this.answeredThisGame = false;
    this.index.set(0);
    this.startRound();
  }

  /** Volgende: the next round, or a new game after the last. */
  protected next(): void {
    if (this.phase() === 'finished') {
      this.start();
      return;
    }
    this.index.update((index) => index + 1);
    this.startRound();
  }

  /** Bekijk nog eens: draws the pattern of this round again; the choices stay as they were. */
  protected replay(): void {
    const pattern = this.current();
    if (pattern) this.draw(pattern.id);
  }

  protected choose(choice: TraceChoice): void {
    const pattern = this.current();
    if (!pattern || !this.choicesOpen()) return;
    const correct = choice.id === pattern.answer;
    this.chosen.set(choice.id);
    this.answers.update((answers) => [
      ...answers,
      { pattern: pattern.id, choice: choice.id, correct },
    ]);
    const ted = this.ted();
    const right = this.config().choices.find((item) => item.id === pattern.answer);
    const parts = correct
      ? [pick(ted.correct, this.random) ?? '', pattern.explanation]
      : [
          pick(ted.incorrect, this.random) ?? '',
          `Het was: ${right?.label ?? pattern.answer}.`,
          pattern.explanation,
        ];
    if (!this.answeredThisGame) {
      this.answeredThisGame = true;
      this.answered.emit();
    }
    if (this.index() + 1 < this.rounds().length) {
      this.phase.set('answered');
      this.line.set({ mood: correct ? 'happy' : 'oops', parts: parts.filter(Boolean) });
    } else {
      this.finish(parts.filter(Boolean));
    }
    this.focusAfterRender('.next');
  }

  protected isChosen(choice: TraceChoice): boolean {
    return this.chosen() === choice.id;
  }

  private finish(parts: string[]): void {
    const score = this.score();
    const total = this.rounds().length;
    const good = score >= total - 1;
    this.phase.set('finished');
    this.line.set({
      mood: good ? 'cool' : 'happy',
      parts: [
        ...parts,
        `${score} van ${total} goed.`,
        good ? TRACE_TEXT.finishedGood : TRACE_TEXT.finishedRetry,
      ],
    });
    this.completed.emit({ score, total, detail: { rounds: this.answers() } });
  }

  private startRound(): void {
    const pattern = this.current();
    if (!pattern) return;
    this.phase.set('round');
    this.chosen.set(null);
    this.roundDrawn.set(false);
    this.line.set({ mood: 'thinking', parts: [TRACE_TEXT.drawing] });
    this.draw(pattern.id, () => {
      this.roundDrawn.set(true);
      this.line.set({ mood: 'thinking', parts: [TRACE_TEXT.choose] });
    });
    this.focusAfterRender('.say');
  }

  private current(): TracePattern | undefined {
    const id = this.rounds()[this.index()];
    return id === undefined ? undefined : this.patterns().get(id);
  }

  /** Draws pattern `id` over durationMs (at once with reduced motion), then calls `done`. */
  private draw(id: string, done?: () => void): void {
    this.stop();
    this.shown.set(id);
    if (this.reducedMotion()) {
      this.end.set(1);
      this.drawing.set(false);
      done?.();
      return;
    }
    const duration = this.config().durationMs;
    this.drawing.set(true);
    this.end.set(MIN_END);
    let begin: number | null = null;
    const step = (time: number) => {
      begin ??= time;
      const t = Math.min(1, (time - begin) / duration);
      this.end.set(Math.max(t, MIN_END));
      if (t < 1) {
        this.frame = this.frames.request(step);
        return;
      }
      this.frame = null;
      this.drawing.set(false);
      done?.();
    };
    this.frame = this.frames.request(step);
  }

  private stop(): void {
    if (this.frame !== null) this.frames.cancel(this.frame);
    this.frame = null;
    this.drawing.set(false);
  }

  /** Moves the focus after the next render, so it never stays on a button that is gone. */
  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
