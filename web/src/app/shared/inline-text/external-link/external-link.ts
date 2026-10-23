import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Only these become a link; anything else (content:check refuses it anyway) stays plain text. */
const HTTPS = /^https:\/\/[^\s]+$/;

/**
 * A link out of Snuffel, from lesson content only (sources, links in text and items). Opens in a
 * new tab with rel="noopener noreferrer" and says so to screen readers.
 */
@Component({
  selector: 'snf-external-link',
  templateUrl: './external-link.html',
  styleUrl: './external-link.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExternalLink {
  readonly url = input.required<string>();
  readonly label = input.required<string>();
  /**
   * Text for screen readers only, before and after the visible label (for example "Bron: <title>
   * (" and ")"). The whole name is then one visually hidden text and the visible label is hidden
   * from screen readers: separate hidden pieces would be read with extra spaces, and an
   * aria-label would not contain the visible text as axe requires.
   */
  readonly hiddenBefore = input('');
  readonly hiddenAfter = input('');

  protected readonly isHttps = computed(() => HTTPS.test(this.url()));
}
