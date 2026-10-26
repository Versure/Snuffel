import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { LessonTed, TypingDrillConfig, TypingGoals } from '../../core/content/content.types';
import { CLOCK } from '../../core/clock/clock';
import { INPUT_DEVICE } from '../../core/input-device/input-device';
import { RANDOM } from '../../core/random/random';
import { InlineText } from '../../shared/inline-text/inline-text/inline-text';
import { pick } from '../../shared/quiz/shuffle';
import { Button } from '../../shared/ui/button/button';
import { Card } from '../../shared/ui/card/card';
import { TedSays } from '../../shared/ui/ted-says/ted-says';
import type { TedMood } from '../../shared/ui/ted/ted';
import type { InteractionComponent, InteractionResult } from '../interaction';
import { accuracy } from '../../core/typing/accuracy';
import {
  drillResult,
  expectedChar,
  goalsMet,
  keyCount,
  type KeyMistake,
  startDrill,
  typeChar,
} from './drill';
import { TypingKeyboard } from './keyboard/keyboard';
import { keyForChar, keyName } from './keyboard-layout';
import { TypedInput } from './typed-input';
import { dutchList, newKeysText } from './typing-text';

export const TYPING_TEXT = {
  touchOnly: 'Voor deze oefening heb je een toetsenbord nodig. Doe hem op een laptop of computer.',
  ready: 'Zet je vingers klaar en kijk naar het scherm, niet naar je handen.',
  start: 'Start',
  field: 'Typvak',
  help: 'Typ de regel over. Fouten tellen mee; typ gewoon door.',
  nextLine: 'Daarna:',
  refocus: 'Klik op de regel om verder te typen.',
  capsLock: 'Caps Lock staat aan',
  restart: 'Opnieuw beginnen',
  restartQuestion: 'Weet je het zeker? Wat je al getypt hebt, gaat weg.',
  restartYes: 'Ja, opnieuw beginnen',
  restartNo: 'Nee, verder typen',
  finishedTitle: 'Klaar!',
  noMistakes: 'Geen fouten!',
  again: 'Nog een keer',
  wrong: 'fout',
  space: 'spatie',
} as const;

/** How many keys the end screen names under "Vaakst fout". */
const SHOWN_MISTAKES = 3;

/** Where a drill is: a touch-only message, before Start, typing, or finished. */
export type TypingPhase = 'touch' | 'start' | 'typing' | 'finished';

/** What Ted says: his mood and the parts of his text (lesson text with inline markup). */
interface TedLine {
  readonly mood: TedMood;
  readonly parts: readonly string[];
}

/** The end screen. */
interface DrillOutcome {
  readonly accuracy: number;
  readonly keysPerMinute: number;
  readonly score: number;
  readonly total: number;
  readonly mistakes: readonly KeyMistake[];
}

/** Keys that are no real typing on their own: they never end the touch-only message. */
const NO_REAL_KEY = new Set([
  'Shift',
  'Control',
  'Alt',
  'AltGraph',
  'Meta',
  'CapsLock',
  'Tab',
  'Escape',
  'Dead',
  'Process',
  'Unidentified',
]);

let nextId = 0;

/** "92% goed", with the goals as a sentence part: "90% goed en 60 aanslagen per minuut". */
function goalText(goals: TypingGoals): string {
  const parts: string[] = [];
  if (goals.accuracy !== undefined) parts.push(`${goals.accuracy}% goed`);
  if (goals.keysPerMinute !== undefined) parts.push(`${goals.keysPerMinute} aanslagen per minuut`);
  return dutchList(parts);
}

/**
 * Touch typing (`typing-drill`, plan M15): the child types the lines of the config one after the
 * other in a hidden input field (also after a dead key), sees per char right or wrong (a wrong
 * char is red with a ✗ and the cursor moves on), and a keyboard with the finger for the next
 * key. After the last line: accuracy, keys per minute and the most missed keys, and Ted reacts to
 * the goals. A device with only a touch screen gets a message, until a real key arrives. Emits
 * `answered` at the first key of a drill and `completed` after the last line; the typed text is
 * never kept.
 */
@Component({
  selector: 'snf-typing-drill',
  imports: [Button, Card, InlineText, TedSays, TypingKeyboard],
  templateUrl: './typing-drill.html',
  styleUrl: './typing-drill.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onDocumentKeydown($event)',
  },
})
export class TypingDrill implements InteractionComponent<TypingDrillConfig> {
  private readonly random = inject(RANDOM);
  private readonly clock = inject(CLOCK);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly config = input.required<TypingDrillConfig>();
  readonly ted = input.required<LessonTed>();
  readonly answered = output<void>();
  readonly completed = output<InteractionResult>();

  protected readonly text = TYPING_TEXT;
  private readonly baseId = `snf-typen-${nextId++}`;
  protected readonly helpId = `${this.baseId}-uitleg`;
  protected readonly confirmId = `${this.baseId}-opnieuw`;

  protected readonly phase = signal<TypingPhase>(
    inject(INPUT_DEVICE).touchOnly() ? 'touch' : 'start',
  );
  protected readonly drill = signal(startDrill([]));
  protected readonly capsLock = signal(false);
  /** Whether Opnieuw beginnen asks first (a Tab and a space must not wipe what was typed). */
  protected readonly confirmRestart = signal(false);
  /** Whether the typing field has the focus. */
  protected readonly focused = signal(false);
  /** The polite live region: the line at its start, and the result at the end. */
  protected readonly announcement = signal('');
  protected readonly outcome = signal<DrillOutcome | null>(null);
  protected readonly endLine = signal<TedLine>({ mood: 'happy', parts: [] });
  private answeredThisDrill = false;

  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  protected readonly lines = computed(() => this.config().lines);
  protected readonly newText = computed(() => newKeysText(this.config().newKeys));
  protected readonly lineNumber = computed(() =>
    Math.min(this.drill().line + 1, this.lines().length),
  );

  /** The chars of the line of the cursor, with their state and whether the cursor is on it. */
  protected readonly chars = computed(() => {
    const drill = this.drill();
    const line = Math.min(drill.line, drill.lines.length - 1);
    const chars = drill.lines[line] ?? [];
    const marks = drill.marks[line] ?? [];
    return chars.map((char, index) => ({
      char,
      space: char === ' ',
      mark: marks[index] ?? 'pending',
      current: !drill.finished && drill.line === line && drill.position === index,
    }));
  });

  protected readonly nextLine = computed(() => this.lines()[this.drill().line + 1] ?? null);

  /** The key for the next char, for the keyboard. */
  protected readonly nextPress = computed(() => {
    const char = expectedChar(this.drill());
    return char === null ? null : keyForChar(char);
  });

  protected readonly shownMistakes = computed(() =>
    (this.outcome()?.mistakes ?? []).slice(0, SHOWN_MISTAKES),
  );
  protected readonly mistakesText = computed(() =>
    dutchList(this.shownMistakes().map((item) => `${keyName(item.key)} (${item.count}×)`)),
  );

  constructor() {
    // Reads typed chars from the field while it is there: DOM listeners outside Angular.
    effect((onCleanup) => {
      const field = this.field()?.nativeElement;
      if (!field) return;
      const reader = new TypedInput(field, {
        char: (char) => this.onChar(char),
        capsLock: (on) => this.capsLock.set(on),
      });
      onCleanup(() => reader.destroy());
    });
  }

  /** Start, Opnieuw beginnen and Nog een keer: a new drill from the first line. */
  protected start(): void {
    this.drill.set(startDrill(this.lines()));
    this.outcome.set(null);
    this.capsLock.set(false);
    this.confirmRestart.set(false);
    this.answeredThisDrill = false;
    this.phase.set('typing');
    this.announceLine(0);
    this.focusAfterRender('input.field');
  }

  /** Opnieuw beginnen: at once before the first key, else after a question. */
  protected requestRestart(): void {
    if (keyCount(this.drill()) === 0) {
      this.start();
      return;
    }
    this.confirmRestart.set(true);
    // The safe answer gets the focus, so another space does not wipe anything either.
    this.focusAfterRender('.keep-typing');
  }

  /** Nee, verder typen: back to the field, where the drill goes on. */
  protected keepTyping(): void {
    this.confirmRestart.set(false);
    this.focusAfterRender('input.field');
  }

  /** On a touch-only device a real key press shows the drill; that key does not count. */
  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (this.phase() !== 'touch') return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (NO_REAL_KEY.has(event.key) || isTextField(event.target)) return;
    this.phase.set('start');
    this.focusAfterRender('.start');
  }

  private onChar(char: string): void {
    const before = this.drill();
    if (this.phase() !== 'typing' || before.finished) return;
    const after = typeChar(before, char, this.clock());
    this.drill.set(after);
    this.confirmRestart.set(false);
    if (!this.answeredThisDrill) {
      this.answeredThisDrill = true;
      this.answered.emit();
    }
    if (after.finished) {
      this.finish();
    } else if (after.line !== before.line) {
      this.announceLine(after.line);
    }
  }

  private announceLine(line: number): void {
    const lines = this.lines();
    this.announcement.set(`Regel ${line + 1} van ${lines.length}: ${lines[line] ?? ''}`);
  }

  private finish(): void {
    const result = drillResult(this.drill());
    const outcome: DrillOutcome = {
      accuracy: accuracy(result.score, result.total),
      keysPerMinute: result.detail.keysPerMinute,
      score: result.score,
      total: result.total,
      mistakes: result.detail.mistakes,
    };
    this.outcome.set(outcome);
    const line = this.tedLine(outcome);
    this.endLine.set(line);
    this.phase.set('finished');
    const mistakes = this.shownMistakes().map((item) => keyName(item.key));
    const summary = [
      `${outcome.accuracy}% goed, ${outcome.keysPerMinute} aanslagen per minuut.`,
      mistakes.length ? `Vaakst fout: ${dutchList(mistakes)}.` : TYPING_TEXT.noMistakes,
    ];
    this.announcement.set(summary.join(' '));
    this.completed.emit(result);
    this.focusAfterRender('.say');
  }

  /** Ted after a drill (plan M15 question 11): the goals only change what he says. */
  private tedLine(outcome: DrillOutcome): TedLine {
    const ted = this.ted();
    const goals = this.config().goals;
    if (!goals) return { mood: 'happy', parts: [pick(ted.correct, this.random) ?? ''] };
    if (goalsMet(outcome, goals)) {
      return {
        mood: 'cool',
        parts: [pick(ted.correct, this.random) ?? '', `Doel gehaald: ${goalText(goals)}.`],
      };
    }
    const accuracyMissed = goals.accuracy !== undefined && outcome.accuracy < goals.accuracy;
    return {
      mood: 'thinking',
      parts: [
        pick(ted.incorrect, this.random) ?? '',
        `Je doel is ${goalText(goals)}.`,
        accuracyMissed
          ? 'Typ rustig; snelheid komt vanzelf.'
          : 'Oefen nog eens; met oefenen gaat het vanzelf sneller.',
      ],
    };
  }

  /** Moves the focus after the next render, so it never stays on something that is gone. */
  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}

/**
 * A key in a text field elsewhere on the page (the on-screen keyboard of a phone types there too)
 * says nothing about a real keyboard.
 */
function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !==
      null
  );
}
