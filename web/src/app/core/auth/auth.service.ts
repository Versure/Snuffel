import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ClientResponseError, type AuthRecord } from 'pocketbase';
import { PocketBaseService } from '../pocketbase/pocketbase.service';
import type { UserRecord, UserRole } from '../pocketbase/types';

const roles: readonly UserRole[] = ['child', 'parent'];

/** Picks the app fields from an auth record; anything that is not a Snuffel user gives null. */
function toUserRecord(record: AuthRecord): UserRecord | null {
  if (!record || record['collectionName'] !== 'users') return null;
  const role = record['role'] as UserRole;
  if (!roles.includes(role)) return null;
  return {
    id: String(record.id),
    username: String(record['username'] ?? ''),
    name: String(record['name'] ?? ''),
    role,
  };
}

/**
 * The logged-in user as signals, kept in sync with the PocketBase auth store (also when
 * another tab logs in or out). The role here is only for convenience in the UI; the
 * access rules in PocketBase are the real protection.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly pb = inject(PocketBaseService).client;
  private readonly router = inject(Router);

  private readonly current = signal<UserRecord | null>(this.readUser());

  readonly user = this.current.asReadonly();
  readonly isLoggedIn = computed(() => this.current() !== null);
  readonly role = computed<UserRole | null>(() => this.current()?.role ?? null);

  constructor() {
    const unsubscribe = this.pb.authStore.onChange(() => this.current.set(this.readUser()));
    inject(DestroyRef).onDestroy(unsubscribe);
  }

  /** Logs in with username and password; throws the ClientResponseError when that fails. */
  async login(username: string, password: string): Promise<UserRecord> {
    await this.pb.collection('users').authWithPassword(username.trim().toLowerCase(), password);
    const user = this.readUser();
    if (!user) {
      this.pb.authStore.clear();
      throw new Error('Logged in, but not as a Snuffel user.');
    }
    return user;
  }

  /** Forgets the session (in this and every other tab) and goes to /login. */
  logout(): Promise<boolean> {
    this.pb.authStore.clear();
    return this.router.navigateByUrl('/login');
  }

  /**
   * Renews the token. When the server refuses it (expired, account deleted, password
   * changed, forged) the session is cleared and the app goes to /login. When the server
   * cannot be reached, the session stays.
   */
  async refresh(): Promise<void> {
    const store = this.pb.authStore;
    if (!store.token) return;
    if (!store.isValid || !this.readUser()) {
      store.clear();
      return;
    }
    try {
      await this.pb.collection('users').authRefresh();
    } catch (error) {
      if (error instanceof ClientResponseError && [401, 403, 404].includes(error.status)) {
        store.clear();
        await this.router.navigateByUrl('/login');
      }
    }
  }

  private readUser(): UserRecord | null {
    const store = this.pb.authStore;
    return store.isValid ? toUserRecord(store.record) : null;
  }
}
