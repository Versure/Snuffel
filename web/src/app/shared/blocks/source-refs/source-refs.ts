import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { Source } from '../../../core/content/content.types';
import { ExternalLink } from '../../inline-text/external-link/external-link';
import { LessonContext } from '../../lesson-context/lesson-context';

/**
 * "Bron:" with a link per source below a block or card. The link text is the publisher, the
 * accessible name "Bron: <title> (<publisher>)". Nothing for an empty list or without a context.
 */
@Component({
  selector: 'snf-source-refs',
  imports: [ExternalLink],
  templateUrl: './source-refs.html',
  styleUrl: './source-refs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SourceRefs {
  readonly refs = input.required<readonly string[]>();

  private readonly context = inject(LessonContext, { optional: true });

  protected readonly sources = computed(() => {
    const context = this.context;
    if (!context) return [];
    return this.refs()
      .map((id) => context.source(id))
      .filter((source): source is Source => source !== undefined);
  });
}
