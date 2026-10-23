import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Interaction } from '../../core/content/content.types';
import { Ted } from '../../shared/ui/ted/ted';

/** What the placeholder says per kind of interaction. */
const MESSAGES: Record<Interaction['kind'], string> = {
  'trace-game': 'Dit spel komt binnenkort.',
  'stepped-exercise': 'Deze oefening komt binnenkort.',
};

/**
 * A dark panel in the style of the game from the reference, standing in for an interaction that
 * has no component yet. The configuration is not shown. From M9 on, the registry falls back to
 * this for kinds without a component.
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
