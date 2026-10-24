import { inject, Injectable } from '@angular/core';
import { ClientResponseError } from 'pocketbase';
import { PocketBaseService } from '../pocketbase/pocketbase.service';
import type { UserRecord } from '../pocketbase/types';
import { toProgressError } from '../progress/progress-error';

const fields = 'id,name,username,role';

/** By name (Dutch order), then by username. */
function byName(a: UserRecord, b: UserRecord): number {
  return (
    a.name.localeCompare(b.name, 'nl') ||
    a.username.localeCompare(b.username, 'nl') ||
    a.id.localeCompare(b.id)
  );
}

function toUserRecord(record: UserRecord): UserRecord {
  return {
    id: String(record.id),
    name: String(record.name ?? ''),
    username: String(record.username ?? ''),
    role: record.role,
  };
}

/**
 * Reads the accounts of the children for the parent. Only the fields the app shows are asked;
 * the access rules in PocketBase decide who may read them. Every failure becomes a ProgressError.
 */
@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly pb = inject(PocketBaseService).client;

  /** Every account with the role child, sorted on name and then username. */
  async loadChildren(): Promise<UserRecord[]> {
    try {
      const records = await this.pb.collection('users').getFullList<UserRecord>({
        filter: 'role = "child"',
        fields,
        requestKey: null,
      });
      return records
        .filter((record) => record.role === 'child')
        .map(toUserRecord)
        .sort(byName);
    } catch (error) {
      throw toProgressError(error, 'Loading the children');
    }
  }

  /** One child by id; null when there is no such account or it is not a child. */
  async loadChild(id: string): Promise<UserRecord | null> {
    if (id === '') return null;
    try {
      const record = await this.pb
        .collection('users')
        .getOne<UserRecord>(id, { fields, requestKey: null });
      return record.role === 'child' ? toUserRecord(record) : null;
    } catch (error) {
      if (error instanceof ClientResponseError && error.status === 404) return null;
      throw toProgressError(error, 'Loading the child');
    }
  }
}
