import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import type { UserRecord, UserRole } from './core/pocketbase/types';

describe('App', () => {
  const user = signal<UserRecord | null>(null);
  const logout = vi.fn<() => Promise<boolean>>();

  beforeEach(async () => {
    user.set(null);
    logout.mockReset().mockResolvedValue(true);
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { user, isLoggedIn: () => user() !== null, logout },
        },
      ],
    }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('creates the app', async () => {
    const { fixture } = await render();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('contains a router outlet', async () => {
    const { element } = await render();
    expect(element.querySelector('router-outlet')).not.toBeNull();
  });

  it('shows no top bar without a login', async () => {
    const { element } = await render();
    expect(element.querySelector('snf-top-bar')).toBeNull();
  });

  it('shows the top bar with the name when logged in, and it logs out', async () => {
    user.set({ id: 'a1', username: 'kind-a', name: 'Kind A', role: 'child' });
    const { fixture, element } = await render();
    const bar = element.querySelector('snf-top-bar');
    expect(bar?.textContent).toContain('Kind A');
    bar?.querySelector('button')?.click();
    expect(logout).toHaveBeenCalledTimes(1);

    user.set(null);
    await fixture.whenStable();
    expect(element.querySelector('snf-top-bar')).toBeNull();
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
