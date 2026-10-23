import { ChangeDetectionStrategy, Component, forwardRef, input } from '@angular/core';
import { ExternalLink } from '../external-link/external-link';
import { GlossaryTerm } from '../glossary-term/glossary-term';
import type { InlineToken } from '../inline-markup';

/**
 * Renders inline tokens from parseInline as elements, recursively for bold and italic. A component
 * rather than a recursive ng-template, so strictTemplates checks every token field.
 */
@Component({
  selector: 'snf-inline-tokens',
  // forwardRef: a glossary term renders its definition with InlineText, which uses this component.
  imports: [ExternalLink, forwardRef(() => GlossaryTerm)],
  templateUrl: './inline-tokens.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineTokens {
  readonly tokens = input.required<readonly InlineToken[]>();
  /** Render terms as tappable terms; false renders the shown form as plain text. */
  readonly terms = input(true);
}
