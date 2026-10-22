// Record types as they come from PocketBase (see pocketbase/pb_migrations).

export type UserRole = 'child' | 'parent';

/** The fields of a `users` record that the app uses. */
export interface UserRecord {
  id: string;
  username: string;
  name: string;
  role: UserRole;
}
