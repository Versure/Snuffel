import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import type { UserRecord, UserRole } from './core/pocketbase/types';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('creates the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('contains a router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });
});

describe('App routes', () => {
  const user = signal<UserRecord | null>(null);

  function loginAs(role: UserRole | null): void {
    user.set(role ? { id: 'u1', username: 'test', name: 'Test', role } : null);
  }

  beforeEach(() => {
    loginAs(null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        {
          provide: AuthService,
          useValue: {
            user,
            isLoggedIn: () => user() !== null,
            role: () => user()?.role ?? null,
          },
        },
      ],
    });
  });

  async function open(url: string): Promise<string> {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return TestBed.inject(Router).url;
  }

  it('sends / to /login?terug=%2F without a login', async () => {
    expect(await open('/')).toBe('/login?terug=%2F');
  });

  it('sends /ouder to /login?terug=%2Fouder without a login', async () => {
    expect(await open('/ouder')).toBe('/login?terug=%2Fouder');
  });

  it('keeps /stijl open without a login', async () => {
    expect(await open('/stijl')).toBe('/stijl');
  });

  it('sends a child from /ouder to /', async () => {
    loginAs('child');
    expect(await open('/ouder')).toBe('/');
  });

  it('opens /ouder for a parent', async () => {
    loginAs('parent');
    expect(await open('/ouder')).toBe('/ouder');
  });

  it('sends someone who is logged in from /login to /', async () => {
    loginAs('child');
    expect(await open('/login')).toBe('/');
  });
});
