import { inject, Injectable } from '@angular/core';
import type { ManifestCourse } from '../content/content.types';
import { PocketBaseService } from '../pocketbase/pocketbase.service';
import type { CourseAssignmentRecord, UserRecord } from '../pocketbase/types';
import { toProgressError } from '../progress/progress-error';
import { canSee, isForAllChildren } from './visible-courses';

const collection = 'course_assignments';
const fields = 'id,user,course_id,created,updated';
const noCancel = { requestKey: null };

/**
 * Reads and changes which children see a `selected-children` course (`course_assignments`).
 * Only via PocketBaseService; the access rules decide who may do what (a child reads only its
 * own assignments, only the parent assigns). Every failure becomes a ProgressError.
 */
@Injectable({ providedIn: 'root' })
export class CourseAccessService {
  private readonly pb = inject(PocketBaseService).client;

  /** The ids of the courses assigned to `userId`. */
  async loadAssignedCourseIds(userId: string): Promise<ReadonlySet<string>> {
    try {
      const records = await this.pb
        .collection(collection)
        .getFullList<Pick<CourseAssignmentRecord, 'course_id'>>({
          filter: this.pb.filter('user = {:userId}', { userId }),
          fields: 'course_id',
          ...noCancel,
        });
      return new Set(records.map((record) => String(record.course_id)));
    } catch (error) {
      throw toProgressError(error, 'Loading the course assignments');
    }
  }

  /** Every assignment (for the parent). */
  async loadAssignments(): Promise<CourseAssignmentRecord[]> {
    try {
      return await this.pb
        .collection(collection)
        .getFullList<CourseAssignmentRecord>({ fields, sort: 'created', ...noCancel });
    } catch (error) {
      throw toProgressError(error, 'Loading the course assignments');
    }
  }

  /** Lets child `userId` see course `courseId`. */
  async assign(userId: string, courseId: string): Promise<CourseAssignmentRecord> {
    try {
      return await this.pb
        .collection(collection)
        .create<CourseAssignmentRecord>(
          { user: userId, course_id: courseId },
          { fields, ...noCancel },
        );
    } catch (error) {
      throw toProgressError(error, 'Assigning the course');
    }
  }

  /** Removes an assignment; the progress of the child stays. */
  async unassign(assignmentId: string): Promise<void> {
    try {
      await this.pb.collection(collection).delete(assignmentId, noCancel);
    } catch (error) {
      throw toProgressError(error, 'Removing the course assignment');
    }
  }

  /**
   * Whether `user` may open `course`. The parent and an `all-children` course need no request;
   * otherwise the assignments of the user are loaded. Throws a ProgressError when that fails.
   */
  async canOpen(course: ManifestCourse, user: UserRecord): Promise<boolean> {
    if (user.role === 'parent' || isForAllChildren(course)) return true;
    const assigned = await this.loadAssignedCourseIds(user.id);
    return canSee(course, { role: 'child', assigned });
  }
}
