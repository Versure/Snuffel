import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { TipBlock as TipBlockData } from '../../../core/content/content.types';
import { InlineText } from '../../inline-text/inline-text/inline-text';
import { Card } from '../../ui/card/card';
import { SourceRefs } from '../source-refs/source-refs';

/** Block `tip`: a card with a title ("Tip" when the content gives none). */
@Component({
  selector: 'snf-tip-block',
  imports: [Card, InlineText, SourceRefs],
  templateUrl: './tip-block.html',
  styleUrl: './tip-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TipBlock {
  readonly block = input.required<TipBlockData>();
}
