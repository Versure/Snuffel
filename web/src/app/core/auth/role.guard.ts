import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import type { UserRole } from '../pocketbase/types';
import { AuthService } from './auth.service';

/**
 * Pages for one role (after `authGuard`): anyone else goes to `/`, without an error page.
 * Only convenience: the PocketBase access rules decide what data someone gets.
 */
export function roleGuard(role: UserRole): CanActivateFn {
  return () => {
    if (inject(AuthService).role() === role) return true;
    return inject(Router).createUrlTree(['/']);
  };
}
