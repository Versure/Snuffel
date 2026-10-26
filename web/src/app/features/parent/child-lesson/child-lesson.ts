import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import type {
  InteractionStep,
  Lesson,
  LessonStep,
  ManifestLesson,
} from '../../../core/content/content.types';
import {
  checklistSummary,
  exerciseHelp,
  interactionSummary,
  lastActivity,
  quizSummary,
  typingSummary,
} from '../../../core/progress/child-progress';
import { groupStepStatuses, lessonProgress } from '../../../core/progress/course-progress';
import type { LessonRecords } from '../../../core/progress/progress.service';
import { accuracy } from '../../../interactions/typing-drill/drill';
import { plainText } from '../../../shared/inline-text/inline-markup';
import { Button } from '../../../shared/ui/button/button';
import { LessonStatusLabel } from '../../../shared/ui/lesson-status/lesson-status';
import { activityText } from '../activity-text';
import { CHILD_TEXT } from '../parent-text';

/** One line in the details of a lesson: the title of the step and what the child did. */
export interface LessonDetail {
  readonly stepId: string;
  readonly title: string;
  readonly lines: readonly string[];
}

/** Where clearing the progress of a lesson is: not started, running, or failed (partly). */
export type ClearState = 'idle' | 'clearing' | 'failed';

/** Every record of one lesson, as given when the child has none. */
export const NO_RECORDS: LessonRecords = { steps: [], checklists: [], attempts: [], results: [] };

function hasRecords(records: LessonRecords): boolean {
  return (
    records.steps.length > 0 ||
    records.checklists.length > 0 ||
    records.attempts.length > 0 ||
    records.results.length > 0
  );
}

/** The newest result of the interaction of a step with the current version (newest first). */
function newestResult(step: InteractionStep, lesson: Lesson, records: LessonRecords) {
  return records.results.find(
    (result) =>
      result.interaction_id === step.interaction.id && result.content_version === lesson.version,
  );
}

/** A typing drill: accuracy and speed, the most missed keys, and how often it was done. */
function typingDetail(step: InteractionStep, lesson: Lesson, records: LessonRecords): LessonDetail {
  const title = plainText(step.title);
  const summary = interactionSummary(step, lesson.version, records.results);
  if (!summary.latest) return { stepId: step.id, title, lines: [CHILD_TEXT.typingNotDone] };
  const typing = typingSummary(newestResult(step, lesson, records)?.detail);
  const percent = accuracy(summary.latest.score, summary.latest.total);
  const lines = [CHILD_TEXT.typingScore(percent, typing?.keysPerMinute ?? null)];
  if (typing && typing.mistakes.length > 0) {
    lines.push(CHILD_TEXT.typingMistakes(typing.mistakes));
  }
  lines.push(CHILD_TEXT.typingPlays(summary.plays));
  return { stepId: step.id, title, lines };
}

function detailOf(step: LessonStep, lesson: Lesson, records: LessonRecords): LessonDetail | null {
  const title = plainText(step.title);
  switch (step.type) {
    case 'quiz': {
      const quiz = quizSummary(step, lesson.version, records.attempts);
      if (quiz.answers === 0) return { stepId: step.id, title, lines: [CHILD_TEXT.quizNotDone] };
      const score =
        quiz.answered === quiz.questions
          ? CHILD_TEXT.quizScore(quiz.correct, quiz.questions)
          : CHILD_TEXT.quizPartly(quiz.answered, quiz.questions, quiz.correct);
      return {
        stepId: step.id,
        title,
        lines: [score, CHILD_TEXT.quizAnswers(quiz.answers, quiz.hints)],
      };
    }
    case 'practice': {
      const record = records.checklists.find((candidate) => candidate.checklist_id === step.id);
      const checked = Array.isArray(record?.checked)
        ? record.checked.filter((id): id is string => typeof id === 'string')
        : null;
      const summary = checklistSummary(step, checked);
      return {
        stepId: step.id,
        title,
        lines: [CHILD_TEXT.checklist(summary.checked, summary.total)],
      };
    }
    case 'interaction': {
      if (step.interaction.kind === 'typing-drill') return typingDetail(step, lesson, records);
      const exercise = step.interaction.kind === 'stepped-exercise';
      const summary = interactionSummary(step, lesson.version, records.results);
      if (!summary.latest) {
        return {
          stepId: step.id,
          title,
          lines: [exercise ? CHILD_TEXT.exerciseNotDone : CHILD_TEXT.gameNotPlayed],
        };
      }
      const { score, total } = summary.latest;
      const lines = exercise
        ? [CHILD_TEXT.exerciseScore(score, total), CHILD_TEXT.exercisePlays(summary.plays)]
        : [CHILD_TEXT.gameScore(score, total), CHILD_TEXT.gamePlays(summary.plays)];
      if (exercise) {
        const help = exerciseHelp(newestResult(step, lesson, records)?.detail);
        if (help) lines.push(CHILD_TEXT.exerciseHelp(help.hints, help.solutions, help.exercises));
      }
      return { stepId: step.id, title, lines };
    }
    default:
      // An explanation only counts in the status.
      return null;
  }
}

/**
 * One lesson on the page of a child: the title, the status label, the last activity and, when
 * the child has records and the lesson file is loaded, what the child did per step. The lesson
 * as it is now (the file) decides what counts, as on the lesson page. Without progress
 * (`progress` null: not loaded) only the title, and "Komt nog" for a planned lesson.
 */
@Component({
  selector: 'snf-child-lesson',
  imports: [Button, LessonStatusLabel],
  templateUrl: './child-lesson.html',
  styleUrl: './child-lesson.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChildLesson {
  readonly lesson = input.required<ManifestLesson>();
  /** The lesson file: loaded, failed, or not (yet) loaded. */
  readonly content = input.required<Lesson | 'unavailable' | null>();
  /** Every record of the child for this lesson; null while the progress is unknown. */
  readonly progress = input.required<LessonRecords | null>();
  readonly now = input.required<Date>();
  /** The name of the child, for the question before clearing. */
  readonly childName = input.required<string>();
  readonly clearState = input<ClearState>('idle');
  /**
   * How often the progress of this lesson was cleared on this page. It only goes up, so the
   * question closes after every clear that succeeded, also when the states in between were
   * never rendered.
   */
  readonly clearedCount = input(0);

  /** Load the lesson file again. */
  readonly retry = output();
  /** Clear every record of the child for this lesson (after the parent confirmed). */
  readonly clear = output();

  private readonly injector = inject(Injector);
  private readonly clearButton = viewChild('clearButton', { read: ElementRef<HTMLButtonElement> });
  private readonly question = viewChild<ElementRef<HTMLElement>>('question');
  /** Asked by the parent; false again after a clear that succeeded. */
  private readonly confirming = linkedSignal({
    source: this.clearedCount,
    computation: () => false,
  });

  protected readonly text = CHILD_TEXT;
  protected readonly title = computed(() => plainText(this.lesson().title));
  protected readonly headingId = computed(() => `lesson-${this.lesson().id}`);
  protected readonly planned = computed(() => this.lesson().status !== 'published');

  protected readonly hasRecords = computed(() => {
    const progress = this.progress();
    return progress !== null && hasRecords(progress);
  });

  protected readonly summary = computed(() => {
    const progress = this.progress();
    const lesson = this.lesson();
    if (lesson.status !== 'published') return lessonProgress(lesson, new Map());
    if (!progress) return null;
    return lessonProgress(lesson, groupStepStatuses(progress.steps));
  });

  protected readonly lastActivity = computed(() => {
    const progress = this.progress();
    if (!progress) return null;
    const updated = lastActivity([
      ...progress.steps,
      ...progress.checklists,
      ...progress.attempts,
      ...progress.results,
    ]);
    return updated === null ? null : CHILD_TEXT.lastActivity(activityText(updated, this.now()));
  });

  protected readonly details = computed((): readonly LessonDetail[] | null => {
    const content = this.content();
    const progress = this.progress();
    if (!progress || !this.hasRecords() || content === null || content === 'unavailable') {
      return null;
    }
    return content.steps
      .map((step) => detailOf(step, content, progress))
      .filter((detail): detail is LessonDetail => detail !== null);
  });

  protected readonly questionId = computed(() => `clear-question-${this.lesson().id}`);
  protected readonly questionText = computed(() =>
    CHILD_TEXT.clearQuestion(this.title(), this.childName()),
  );
  /** The question shows while asked and as long as there is something to clear. */
  protected readonly asking = computed(() => this.confirming() && this.hasRecords());
  protected readonly busy = computed(() => this.clearState() === 'clearing');

  protected ask(): void {
    this.confirming.set(true);
    afterNextRender(() => this.question()?.nativeElement.focus(), { injector: this.injector });
  }

  protected cancel(): void {
    if (this.busy()) return;
    this.confirming.set(false);
    afterNextRender(() => this.clearButton()?.nativeElement.focus(), { injector: this.injector });
  }

  protected confirm(): void {
    if (this.busy()) return;
    // The buttons are disabled while clearing; the focus stays in the question.
    this.question()?.nativeElement.focus();
    this.clear.emit();
  }

  protected readonly contentUnavailable = computed(
    () => this.hasRecords() && this.content() === 'unavailable',
  );
}
