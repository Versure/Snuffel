import { Injectable } from '@angular/core';
import PocketBase from 'pocketbase';

/**
 * The one PocketBase client of the app. It talks to the same origin (`/api`), so there is
 * no other host and no CORS; in development ng serve proxies `/api` to PocketBase.
 * The session lives in the SDK's LocalAuthStore (`localStorage`, key `pocketbase_auth`).
 */
@Injectable({ providedIn: 'root' })
export class PocketBaseService {
  readonly client = new PocketBase('/');
}
