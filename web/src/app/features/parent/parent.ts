import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { AccountsService } from '../../core/accounts/accounts.service';
import { ContentService } from '../../core/content/content.service';
import type { ContentManifest } from '../../core/content/content.types';
import type { UserRecord } from '../../core/pocketbase/types';
import { lessonProgress, type StepStatuses } from '../../core/progress/course-progress';
import { ProgressService, type ChildActivity } from '../../core/progress/progress.service';
import { Button } from '../../shared/ui/button/button';
import { TedSays } from '../../shared/ui/ted-says/ted-says';
import { ChildCard, type ChildCardActivity } from './child-card/child-card';
import { CourseAccess } from './course-access/course-access';
import { PARENT_TEXT } from './parent-text';

export type ParentState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly children: readonly UserRecord[] }
  | { readonly kind: 'empty' }
  | { readonly kind: 'unavailable' };

export type ParentActivityState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly activity: ReadonlyMap<string, ChildActivity> }
  | { readonly kind: 'unavailable' };

const noStatuses: StepStatuses = new Map();

/** The completed lessons of every course in the manifest, with the lessons as they are now. */
function lessonsCompleted(manifest: ContentManifest, statuses: StepStatuses): number {
  return manifest.courses
    .flatMap((course) => course.lessons)
    .filter((lesson) => lessonProgress(lesson, statuses).status === 'completed').length;
}

/**
 * The parent overview (`/ouder`): every child as a card with its last activity and completed
 * lessons, and below the cards who sees which course. The children and the content load apart from the activity, so a failing activity
 * still shows the children (without numbers).
 */
@Component({
  selector: 'snf-parent',
  imports: [Button, ChildCard, CourseAccess, TedSays],
  templateUrl: './parent.html',
  styleUrl: './parent.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Parent {
  private readonly accounts = inject(AccountsService);
  private readonly content = inject(ContentService);
  private readonly progress = inject(ProgressService);
  protected readonly text = PARENT_TEXT;
  /** Loaded again on every visit, so the moment of the visit is "now". */
  protected readonly now = new Date();

  private readonly children = resource({ loader: () => this.accounts.loadChildren() });
  private readonly manifest = resource({ loader: () => this.content.loadManifest() });
  private readonly activity = resource({ loader: () => this.progress.loadActivity() });

  protected readonly state = computed((): ParentState => {
    if (this.children.isLoading() || this.manifest.isLoading()) return { kind: 'loading' };
    if (!this.children.hasValue() || !this.manifest.hasValue()) return { kind: 'unavailable' };
    // Only children, also when the server would give more.
    const children = this.children.value().filter((child) => child.role === 'child');
    return children.length === 0 ? { kind: 'empty' } : { kind: 'ready', children };
  });

  /** Every course of the manifest (for the section on who sees which course). */
  protected readonly courses = computed(() =>
    this.manifest.hasValue() ? this.manifest.value().courses : [],
  );

  protected readonly activityState = computed((): ParentActivityState => {
    if (this.activity.isLoading()) return { kind: 'loading' };
    if (this.activity.hasValue()) return { kind: 'ready', activity: this.activity.value() };
    return this.activity.status() === 'error' ? { kind: 'unavailable' } : { kind: 'loading' };
  });

  protected activityOf(child: UserRecord): ChildCardActivity | null {
    const state = this.activityState();
    if (state.kind !== 'ready' || !this.manifest.hasValue()) return null;
    const activity = state.activity.get(child.id);
    return {
      lessonsCompleted: lessonsCompleted(this.manifest.value(), activity?.statuses ?? noStatuses),
      lastActivity: activity?.lastActivity ?? null,
    };
  }

  protected retry(): void {
    if (!this.children.hasValue()) this.children.reload();
    if (!this.manifest.hasValue()) this.manifest.reload();
    if (!this.activity.hasValue()) this.activity.reload();
  }

  protected retryActivity(): void {
    this.activity.reload();
  }
}
