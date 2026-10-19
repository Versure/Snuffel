import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type SpeechBubbleTail = 'left' | 'bottom';

/** Comic speech bubble, as `.ballon` in the reference. The tail is decoration (a pseudo-element). */
@Component({
  selector: 'snf-speech-bubble',
  templateUrl: './speech-bubble.html',
  styleUrl: './speech-bubble.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.snf-speech-bubble--left]': "tail() === 'left'",
    '[class.snf-speech-bubble--bottom]': "tail() === 'bottom'",
  },
})
export class SpeechBubble {
  readonly tail = input<SpeechBubbleTail>('left');
}
