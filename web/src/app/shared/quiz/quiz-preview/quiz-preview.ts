import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { QuizStep } from '../../../core/content/content.types';
import { InlineText } from '../../inline-text/inline-text/inline-text';
import { TedSays } from '../../ui/ted-says/ted-says';

/**
 * A readable preview of a quiz until M8 brings the real one (`snf-quiz`): every question with
 * its options in content order, as plain text. No buttons, no feedback, no hints and no sign of
 * the correct option.
 */
@Component({
  selector: 'snf-quiz-preview',
  imports: [InlineText, TedSays],
  templateUrl: './quiz-preview.html',
  styleUrl: './quiz-preview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizPreview {
  readonly step = input.required<QuizStep>();

  protected letter(index: number): string {
    return String.fromCharCode(65 + index);
  }
}
