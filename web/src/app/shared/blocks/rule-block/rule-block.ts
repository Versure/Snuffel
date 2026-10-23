import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { RuleBlock as RuleBlockData } from '../../../core/content/content.types';
import { InlineText } from '../../inline-text/inline-text/inline-text';
import { SourceRefs } from '../source-refs/source-refs';

/** Block `rule`: the rule to remember, on a pink block with ink text (decision M2). */
@Component({
  selector: 'snf-rule-block',
  imports: [InlineText, SourceRefs],
  templateUrl: './rule-block.html',
  styleUrl: './rule-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleBlock {
  readonly block = input.required<RuleBlockData>();
}
