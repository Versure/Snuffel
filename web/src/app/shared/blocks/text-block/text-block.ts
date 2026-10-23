import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { TextBlock as TextBlockData } from '../../../core/content/content.types';
import { InlineText } from '../../inline-text/inline-text/inline-text';
import { SourceRefs } from '../source-refs/source-refs';

/** Block `text`: a paragraph with its sources. */
@Component({
  selector: 'snf-text-block',
  imports: [InlineText, SourceRefs],
  templateUrl: './text-block.html',
  styleUrl: './text-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextBlock {
  readonly block = input.required<TextBlockData>();
}
