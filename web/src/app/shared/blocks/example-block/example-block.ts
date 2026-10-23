import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ExampleBlock as ExampleBlockData } from '../../../core/content/content.types';
import { InlineText } from '../../inline-text/inline-text/inline-text';
import { Card } from '../../ui/card/card';
import { SourceRefs } from '../source-refs/source-refs';

/** Block `example`: a situation from practice, in a card. */
@Component({
  selector: 'snf-example-block',
  imports: [Card, InlineText, SourceRefs],
  templateUrl: './example-block.html',
  styleUrl: './example-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExampleBlock {
  readonly block = input.required<ExampleBlockData>();
}
