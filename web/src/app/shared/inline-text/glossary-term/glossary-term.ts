import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { LessonContext } from '../../lesson-context/lesson-context';
import { InlineText } from '../inline-text/inline-text';

let nextId = 0;

/**
 * A subject term in running text (`[[term]]`). A button with a dotted underline; tapping shows
 * the definition from the glossary in a small balloon right below it, tapping again or Escape
 * closes it (focus stays on the term). Without a definition in the lesson context: plain text.
 */
@Component({
  selector: 'snf-glossary-term',
  // forwardRef: InlineText renders terms, and a definition is rendered with InlineText.
  imports: [forwardRef(() => InlineText)],
  templateUrl: './glossary-term.html',
  styleUrl: './glossary-term.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(keydown.escape)': 'close()',
  },
})
export class GlossaryTerm {
  /** The glossary term. */
  readonly term = input.required<string>();
  /** The shown form. */
  readonly text = input.required<string>();

  private readonly context = inject(LessonContext, { optional: true });
  private readonly button = viewChild<ElementRef<HTMLButtonElement>>('button');

  protected readonly definitionId = `snf-term-${nextId++}`;
  protected readonly definition = computed(() => this.context?.definition(this.term()));
  protected readonly open = signal(false);

  protected toggle(): void {
    this.open.update((open) => !open);
  }

  /** Closes the balloon and keeps the focus on the term. */
  close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.button()?.nativeElement.focus();
  }
}
