import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { UserRecord } from '../../../core/pocketbase/types';
import { activityText } from '../activity-text';
import { PARENT_TEXT } from '../parent-text';

/** What the card of a child shows of its progress. */
export interface ChildCardActivity {
  readonly lessonsCompleted: number;
  /** The newest `updated` of every record of the child, or null without records. */
  readonly lastActivity: string | null;
}

/**
 * A child in the parent overview: one link to the page of the child with the name, the last
 * activity and the completed lessons. Without activity (`null`, not loaded) there are no
 * numbers: "Nog niet actief" or "0 lessen klaar" would lie.
 */
@Component({
  selector: 'snf-child-card',
  imports: [RouterLink],
  templateUrl: './child-card.html',
  styleUrl: './child-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChildCard {
  readonly child = input.required<UserRecord>();
  readonly activity = input.required<ChildCardActivity | null>();
  readonly now = input.required<Date>();

  protected readonly link = computed(() => ['/ouder', this.child().id]);
  protected readonly name = computed(() => this.child().name || this.child().username);
  protected readonly lastActivity = computed(() => {
    const activity = this.activity();
    if (!activity) return null;
    return activity.lastActivity === null
      ? PARENT_TEXT.notActive
      : PARENT_TEXT.lastActivity(activityText(activity.lastActivity, this.now()));
  });
  protected readonly lessonsCompleted = computed(() => {
    const activity = this.activity();
    return activity ? PARENT_TEXT.lessonsCompleted(activity.lessonsCompleted) : null;
  });
}
