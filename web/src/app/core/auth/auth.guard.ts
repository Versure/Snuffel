import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Pages that need a login: otherwise to `/login?terug=<path>`. */
export const authGuard: CanActivateFn = (_route, state) => {
  if (inject(AuthService).isLoggedIn()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { terug: state.url } });
};

/** The login page itself: whoever is logged in already goes to `/`. */
export const guestGuard: CanActivateFn = () => {
  if (!inject(AuthService).isLoggedIn()) return true;
  return inject(Router).createUrlTree(['/']);
};
