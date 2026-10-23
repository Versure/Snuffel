import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { PracticeStep } from '../../../core/content/content.types';
import { ExternalLink } from '../../inline-text/external-link/external-link';
import { InlineText } from '../../inline-text/inline-text/inline-text';
import { StickyNote } from '../../ui/sticky-note/sticky-note';

/**
 * A practice step on a sticky note: the items as a list without checkboxes (the checklist that
 * remembers ticks comes with M8), their links, and the success criterion in bold.
 */
@Component({
  selector: 'snf-practice-list',
  imports: [ExternalLink, InlineText, StickyNote],
  templateUrl: './practice-list.html',
  styleUrl: './practice-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PracticeList {
  readonly step = input.required<PracticeStep>();
}
