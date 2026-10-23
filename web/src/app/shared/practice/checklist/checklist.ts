import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import type { PracticeStep } from '../../../core/content/content.types';
import { ExternalLink } from '../../inline-text/external-link/external-link';
import { InlineText } from '../../inline-text/inline-text/inline-text';
import { LessonProgress } from '../../lesson-progress/lesson-progress';
import { Button } from '../../ui/button/button';
import { StickyNote } from '../../ui/sticky-note/sticky-note';
import { TedSays } from '../../ui/ted-says/ted-says';

/**
 * A practice step as a checklist on a sticky note, as in the reference: per item a real checkbox
 * with the whole row as its label, links next to the label (a tap on a link ticks nothing), and
 * the success criterion in bold. The ticks come from and go to LessonProgress; without it (for
 * example on a page without a lesson) they live in memory only.
 */
@Component({
  selector: 'snf-checklist',
  imports: [Button, ExternalLink, InlineText, StickyNote, TedSays],
  templateUrl: './checklist.html',
  styleUrl: './checklist.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Checklist {
  private readonly progress = inject(LessonProgress, { optional: true });

  readonly step = input.required<PracticeStep>();

  private readonly local = signal<readonly string[]>([]);

  protected readonly ticked = computed(
    () => new Set(this.progress ? this.progress.checked(this.step().id) : this.local()),
  );
  protected readonly state = computed(() => this.progress?.state() ?? 'ready');
  protected readonly disabled = computed(() => this.state() !== 'ready');
  protected readonly error = computed(() => this.progress?.saveError(this.step().id) ?? null);

  protected inputId(itemId: string): string {
    return `vinkje-${this.step().id}-${itemId}`;
  }

  protected onChange(itemId: string, event: Event): void {
    const on = (event.target as HTMLInputElement).checked;
    const allItemIds = this.step().items.map((item) => item.id);
    if (this.progress) {
      void this.progress.toggle(this.step().id, itemId, on, allItemIds);
      return;
    }
    const next = new Set(this.local());
    if (on) next.add(itemId);
    else next.delete(itemId);
    this.local.set(allItemIds.filter((id) => next.has(id)));
  }

  protected retry(): void {
    void this.progress?.reload();
  }
}
