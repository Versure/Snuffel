import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  provideRouter,
  Router,
  type RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import type { UserRole } from '../pocketbase/types';
import { AuthService } from './auth.service';
import { roleGuard } from './role.guard';

describe('roleGuard', () => {
  const role = signal<UserRole | null>(null);

  beforeEach(() => {
    role.set(null);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { role } }],
    });
  });

  function run(required: UserRole) {
    return TestBed.runInInjectionContext(() =>
      roleGuard(required)({} as ActivatedRouteSnapshot, { url: '/ouder' } as RouterStateSnapshot),
    );
  }

  it('sends a child on a parent page to /', () => {
    role.set('child');
    const result = run('parent');
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
  });

  it('lets a parent through', () => {
    role.set('parent');
    expect(run('parent')).toBe(true);
  });

  it('sends someone without a role to /', () => {
    expect(run('parent')).toBeInstanceOf(UrlTree);
  });

  it('works for the child role too', () => {
    role.set('child');
    expect(run('child')).toBe(true);
    role.set('parent');
    expect(run('child')).toBeInstanceOf(UrlTree);
  });
});
