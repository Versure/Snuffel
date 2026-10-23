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
  /** A fuller accessible name than the visible label (it must contain the label). */
  readonly accessibleName = input<string>();

  protected readonly isHttps = computed(() => HTTPS.test(this.url()));
  protected readonly ariaLabel = computed(() => {
    const name = this.accessibleName();
    return name ? `${name} (opent in een nieuw tabblad)` : null;
  });
}
