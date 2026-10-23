import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type {
  FaqEntry,
  FurtherReading,
  GlossaryEntry,
  Source,
} from '../../../core/content/content.types';
import { ExternalLink } from '../../../shared/inline-text/external-link/external-link';
import { InlineText } from '../../../shared/inline-text/inline-text/inline-text';
import { LessonContext } from '../../../shared/lesson-context/lesson-context';

interface Reading {
  readonly source: Source;
  readonly why: string;
}

/**
 * The end of a lesson: the glossary (alphabetical), further reading and the FAQ. An empty list
 * gives no section.
 */
@Component({
  selector: 'snf-lesson-end',
  imports: [ExternalLink, InlineText],
  templateUrl: './lesson-end.html',
  styleUrl: './lesson-end.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonEnd {
  readonly glossary = input.required<readonly GlossaryEntry[]>();
  readonly furtherReading = input.required<readonly FurtherReading[]>();
  readonly faq = input.required<readonly FaqEntry[]>();

  private readonly context = inject(LessonContext, { optional: true });

  protected readonly sortedGlossary = computed(() =>
    [...this.glossary()].sort((a, b) =>
      a.term.localeCompare(b.term, 'nl', { sensitivity: 'base' }),
    ),
  );

  /** Further reading with its source; an entry whose source is unknown is left out. */
  protected readonly reading = computed(() =>
    this.furtherReading().flatMap((entry): Reading[] => {
      const source = this.context?.source(entry.sourceRef);
      return source ? [{ source, why: entry.why }] : [];
    }),
  );
}
