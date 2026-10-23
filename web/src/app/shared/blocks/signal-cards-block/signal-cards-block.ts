import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { SignalCardsBlock as SignalCardsBlockData } from '../../../core/content/content.types';
import { InlineText } from '../../inline-text/inline-text/inline-text';
import { SignalIcon } from '../signal-icon/signal-icon';
import { SourceRefs } from '../source-refs/source-refs';

/** Block `signal-cards`: cards with an icon, a title, a text and sources. */
@Component({
  selector: 'snf-signal-cards-block',
  imports: [InlineText, SignalIcon, SourceRefs],
  templateUrl: './signal-cards-block.html',
  styleUrl: './signal-cards-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignalCardsBlock {
  readonly block = input.required<SignalCardsBlockData>();
}
