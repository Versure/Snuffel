import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  provideRouter,
  Router,
  type RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { authGuard, guestGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('auth guards', () => {
  const isLoggedIn = signal(false);

  beforeEach(() => {
    isLoggedIn.set(false);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { isLoggedIn } }],
    });
  });

  function run(guard: typeof authGuard, url: string) {
    return TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
  }

  function serialized(result: unknown): string {
    expect(result).toBeInstanceOf(UrlTree);
    return TestBed.inject(Router).serializeUrl(result as UrlTree);
  }

  describe('authGuard', () => {
    it('sends someone who is not logged in to /login with terug', () => {
      expect(serialized(run(authGuard, '/ouder'))).toBe('/login?terug=%2Fouder');
      expect(serialized(run(authGuard, '/'))).toBe('/login?terug=%2F');
    });

    it('keeps the query of the page in terug', () => {
      expect(serialized(run(authGuard, '/les?stap=2'))).toBe('/login?terug=%2Fles%3Fstap%3D2');
    });

    it('lets someone who is logged in through', () => {
      isLoggedIn.set(true);
      expect(run(authGuard, '/ouder')).toBe(true);
    });
  });

  describe('guestGuard', () => {
    it('shows the login page to someone who is not logged in', () => {
      expect(run(guestGuard, '/login')).toBe(true);
    });

    it('sends someone who is logged in to /', () => {
      isLoggedIn.set(true);
      expect(serialized(run(guestGuard, '/login'))).toBe('/');
    });
  });
});
