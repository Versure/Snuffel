import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SpeechBubble, type SpeechBubbleTail } from '../speech-bubble/speech-bubble';
import { Ted, type TedMood, type TedSize } from '../ted/ted';

/**
 * Ted with a speech bubble, as the hero of the reference lesson. Ted is decorative here:
 * the text in the bubble carries the meaning.
 */
@Component({
  selector: 'snf-ted-says',
  imports: [SpeechBubble, Ted],
  templateUrl: './ted-says.html',
  styleUrl: './ted-says.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.snf-ted-says--row]': "tail() === 'left'",
    '[class.snf-ted-says--column]': "tail() === 'bottom'",
    '[class.snf-ted-says--small]': "size() === 'small'",
    '[class.snf-ted-says--large]': "size() === 'large'",
  },
})
export class TedSays {
  readonly mood = input<TedMood>('cool');
  readonly size = input<TedSize>('large');
  readonly wiggle = input(false);
  readonly tail = input<SpeechBubbleTail>('left');
}
