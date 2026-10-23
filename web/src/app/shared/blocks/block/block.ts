import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Block as BlockData } from '../../../core/content/content.types';
import { ExampleBlock } from '../example-block/example-block';
import { FigureBlock } from '../figure-block/figure-block';
import { RuleBlock } from '../rule-block/rule-block';
import { SignalCardsBlock } from '../signal-cards-block/signal-cards-block';
import { TedSaysBlock } from '../ted-says-block/ted-says-block';
import { TextBlock } from '../text-block/text-block';
import { TipBlock } from '../tip-block/tip-block';

/** One block of an explain step: picks the component for its type. */
@Component({
  selector: 'snf-block',
  imports: [
    ExampleBlock,
    FigureBlock,
    RuleBlock,
    SignalCardsBlock,
    TedSaysBlock,
    TextBlock,
    TipBlock,
  ],
  templateUrl: './block.html',
  styleUrl: './block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Block {
  readonly block = input.required<BlockData>();
}
