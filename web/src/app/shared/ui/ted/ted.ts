import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type TedMood = 'cool' | 'happy' | 'thinking' | 'oops';
export type TedSize = 'small' | 'large';

export interface TedMoodDefinition {
  /** Accessible name when Ted is not decorative. */
  label: string;
  /** CSS custom properties from ted.svg that switch the face parts. */
  variables: Record<string, string>;
}

/** One entry per mood: the variables come from the comment in docs/start/assets/ted.svg. */
export const TED_MOODS: Record<TedMood, TedMoodDefinition> = {
  cool: {
    label: 'Ted, een pluizige bruine pup met zonnebril',
    variables: {},
  },
  happy: {
    label: 'Ted, een pluizige bruine pup, kijkt blij',
    variables: { '--m-bril': 'none', '--m-ogen-blij': 'inline' },
  },
  thinking: {
    label: 'Ted, een pluizige bruine pup, denkt na',
    variables: {
      '--m-bril': 'none',
      '--m-ogen-denk': 'inline',
      '--m-mond-blij': 'none',
      '--m-mond-denk': 'inline',
    },
  },
  oops: {
    label: 'Ted, een pluizige bruine pup, kijkt geschrokken',
    variables: {
      '--m-bril': 'none',
      '--m-ogen-denk': 'inline',
      '--m-mond-blij': 'none',
      '--m-mond-oeps': 'inline',
    },
  },
};

/** Ted, the Snuffel mascot. Drawn from the sprite in /assets/ted.svg; the mood switches its face. */
@Component({
  selector: 'snf-ted',
  templateUrl: './ted.html',
  styleUrl: './ted.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.snf-ted--small]': "size() === 'small'",
    '[class.snf-ted--large]': "size() === 'large'",
  },
})
export class Ted {
  readonly mood = input<TedMood>('cool');
  readonly size = input<TedSize>('large');
  /** Hide Ted from assistive technology when text next to him carries the meaning. */
  readonly decorative = input(false);

  protected readonly definition = computed(() => TED_MOODS[this.mood()]);
}
