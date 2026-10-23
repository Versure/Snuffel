import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { FigureBlock as FigureBlockData } from '../../../core/content/content.types';
import { InlineText } from '../../inline-text/inline-text/inline-text';
import { LessonContext } from '../../lesson-context/lesson-context';
import { SourceRefs } from '../source-refs/source-refs';

/**
 * Block `figure`: an svg from the course assets, loaded with the hash from the manifest, on a
 * fixed light frame (an svg in <img> does not follow the theme, so currentColor is black).
 * Without a url (only after a build error) the alt text is shown in the frame instead.
 */
@Component({
  selector: 'snf-figure-block',
  imports: [InlineText, SourceRefs],
  templateUrl: './figure-block.html',
  styleUrl: './figure-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FigureBlock {
  readonly block = input.required<FigureBlockData>();

  private readonly context = inject(LessonContext, { optional: true });

  protected readonly url = computed(() => this.context?.assetUrl(this.block().src));
}
