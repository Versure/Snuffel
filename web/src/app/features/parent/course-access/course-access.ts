import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  PendingTasks,
  resource,
  signal,
} from '@angular/core';
import { CourseAccessService } from '../../../core/access/course-access.service';
import { isForAllChildren } from '../../../core/access/visible-courses';
import type { ManifestCourse } from '../../../core/content/content.types';
import type { UserRecord } from '../../../core/pocketbase/types';
import { plainText } from '../../../shared/inline-text/inline-markup';
import { Button } from '../../../shared/ui/button/button';
import { TedSays } from '../../../shared/ui/ted-says/ted-says';
import { ACCESS_TEXT } from '../parent-text';

export interface AccessCourse {
  readonly id: string;
  readonly title: string;
}

export type CourseAccessState =
  { readonly kind: 'loading' } | { readonly kind: 'ready' } | { readonly kind: 'unavailable' };

/** The key of one checkbox: a child and a course. */
const keyOf = (userId: string, courseId: string) => `${userId}\n${courseId}`;

const byTitle = (a: AccessCourse, b: AccessCourse) => a.title.localeCompare(b.title, 'nl');

/**
 * The section on `/ouder` where the parent chooses which children see a `selected-children`
 * course: per course a group of checkboxes, one per child, that save at once. The courses for
 * every child are one line without checkboxes. Without the assignments there are no checkboxes
 * at all (an empty box that is not true would mislead).
 */
@Component({
  selector: 'snf-course-access',
  imports: [Button, TedSays],
  templateUrl: './course-access.html',
  styleUrl: './course-access.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseAccess {
  private readonly access = inject(CourseAccessService);
  private readonly pendingTasks = inject(PendingTasks);
  protected readonly text = ACCESS_TEXT;

  readonly courses = input.required<readonly ManifestCourse[]>();
  readonly children = input.required<readonly UserRecord[]>();

  private readonly assignments = resource({ loader: () => this.access.loadAssignments() });

  /** The id of each assignment by child and course; follows the server after every save. */
  private readonly assigned = linkedSignal<ReadonlyMap<string, string>>(() => {
    const list = this.assignments.hasValue() ? this.assignments.value() : [];
    return new Map(list.map((record) => [keyOf(record.user, record.course_id), record.id]));
  });
  /** What a checkbox shows while it saves (the choice of the parent). */
  private readonly pending = signal<ReadonlyMap<string, boolean>>(new Map());
  protected readonly message = signal('');

  protected readonly state = computed((): CourseAccessState => {
    if (this.assignments.isLoading()) return { kind: 'loading' };
    return this.assignments.hasValue() ? { kind: 'ready' } : { kind: 'unavailable' };
  });

  protected readonly selectedCourses = computed(() =>
    this.courses()
      .filter((course) => !isForAllChildren(course))
      .map((course) => ({ id: course.id, title: plainText(course.title) }))
      .sort(byTitle),
  );

  protected readonly allChildrenLine = computed(() => {
    const titles = this.courses()
      .filter((course) => isForAllChildren(course))
      .map((course) => ({ id: course.id, title: plainText(course.title) }))
      .sort(byTitle)
      .map((course) => course.title);
    return titles.length > 0 ? ACCESS_TEXT.allChildren(titles) : '';
  });

  protected isChecked(course: AccessCourse, child: UserRecord): boolean {
    const key = keyOf(child.id, course.id);
    return this.pending().get(key) ?? this.assigned().has(key);
  }

  protected isSaving(course: AccessCourse, child: UserRecord): boolean {
    return this.pending().has(keyOf(child.id, course.id));
  }

  protected checkboxId(course: AccessCourse, child: UserRecord): string {
    return `toegang-${course.id}-${child.id}`;
  }

  protected toggle(course: AccessCourse, child: UserRecord, event: Event): void {
    const input = event.target as HTMLInputElement;
    const wanted = input.checked;
    const key = keyOf(child.id, course.id);
    if (this.pending().has(key)) return;
    this.pending.update((current) => new Map(current).set(key, wanted));
    this.message.set('');
    // The app is not stable while it saves (whenStable in tests waits for it).
    void this.pendingTasks.run(() => this.save(course, child, input, wanted));
  }

  private async save(
    course: AccessCourse,
    child: UserRecord,
    input: HTMLInputElement,
    wanted: boolean,
  ): Promise<void> {
    const key = keyOf(child.id, course.id);
    try {
      if (wanted) {
        const record = await this.access.assign(child.id, course.id);
        this.assigned.update((current) => new Map(current).set(key, record.id));
        this.message.set(ACCESS_TEXT.assigned(child.name, course.title));
      } else {
        const id = this.assigned().get(key);
        if (id) await this.access.unassign(id);
        this.assigned.update((current) => {
          const next = new Map(current);
          next.delete(key);
          return next;
        });
        this.message.set(ACCESS_TEXT.unassigned(child.name, course.title));
      }
    } catch {
      // The checkbox jumps back: it shows the server again.
      this.message.set(ACCESS_TEXT.saveFailed);
    } finally {
      this.pending.update((current) => {
        const next = new Map(current);
        next.delete(key);
        return next;
      });
      // The binding may not have seen the click (no render while saving), so set the box to
      // what the server has now: after a failure it jumps back.
      input.checked = this.assigned().has(key);
    }
  }

  protected retry(): void {
    this.assignments.reload();
  }
}
