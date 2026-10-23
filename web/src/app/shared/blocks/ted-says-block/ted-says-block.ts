import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { TedSaysBlock as TedSaysBlockData } from '../../../core/content/content.types';
import { InlineText } from '../../inline-text/inline-text/inline-text';
import { TedSays } from '../../ui/ted-says/ted-says';
import { SourceRefs } from '../source-refs/source-refs';

/** Block `ted-says`: a small Ted with a speech bubble, in the mood from the content. */
@Component({
  selector: 'snf-ted-says-block',
  imports: [InlineText, SourceRefs, TedSays],
  templateUrl: './ted-says-block.html',
  styleUrl: './ted-says-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TedSaysBlock {
  readonly block = input.required<TedSaysBlockData>();
}
