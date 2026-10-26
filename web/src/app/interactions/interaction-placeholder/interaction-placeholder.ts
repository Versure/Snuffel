import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Interaction } from '../../core/content/content.types';
import { Ted } from '../../shared/ui/ted/ted';

/** What the placeholder says per kind of interaction. */
const MESSAGES: Record<Interaction['kind'], string> = {
  'trace-game': 'Dit spel komt binnenkort.',
  'stepped-exercise': 'Deze oefening komt binnenkort.',
  'typing-drill': 'Deze typoefening komt binnenkort.',
};

/**
 * A dark panel in the style of the game from the reference, standing in for an interaction that
 * has no component. The configuration is not shown. snf-interaction falls back to this for
 * every kind without a component in the registry; since M10 every kind has one, so this only
 * stays as a fallback for a new kind whose component is not there yet.
 */
@Component({
  selector: 'snf-interaction-placeholder',
  imports: [Ted],
  templateUrl: './interaction-placeholder.html',
  styleUrl: './interaction-placeholder.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InteractionPlaceholder {
  readonly interaction = input.required<Interaction>();

  protected readonly message = computed(() => MESSAGES[this.interaction().kind]);
}
