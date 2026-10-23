import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { parseInline } from '../inline-markup';
import { InlineTokens } from '../inline-tokens/inline-tokens';

/**
 * Lesson text with its inline markup: bold, italic, links and subject terms. Renders the tokens
 * from parseInline as elements; never inserts the text as HTML, so `<b>` stays text.
 */
@Component({
  selector: 'snf-inline-text',
  imports: [InlineTokens],
  templateUrl: './inline-text.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineText {
  readonly text = input.required<string>();
  /** Render `[[term]]` as a tappable term; false renders the shown form as plain text. */
  readonly terms = input(true);

  protected readonly tokens = computed(() => parseInline(this.text()));
}
