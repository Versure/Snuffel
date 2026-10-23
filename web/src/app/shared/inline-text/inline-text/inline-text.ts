import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, forwardRef, input } from '@angular/core';
import { ExternalLink } from '../external-link/external-link';
import { GlossaryTerm } from '../glossary-term/glossary-term';
import { parseInline } from '../inline-markup';

/**
 * Lesson text with its inline markup: bold, italic, links and subject terms. Renders the tokens
 * from parseInline as elements; never inserts the text as HTML, so `<b>` stays text.
 */
@Component({
  selector: 'snf-inline-text',
  // forwardRef: a glossary term renders its definition with InlineText.
  imports: [NgTemplateOutlet, ExternalLink, forwardRef(() => GlossaryTerm)],
  templateUrl: './inline-text.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineText {
  readonly text = input.required<string>();
  /** Render `[[term]]` as a tappable term; false renders the shown form as plain text. */
  readonly terms = input(true);

  protected readonly tokens = computed(() => parseInline(this.text()));
}
