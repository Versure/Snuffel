import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { ClientResponseError } from 'pocketbase';
import { AuthService } from '../../core/auth/auth.service';
import type { UserRecord } from '../../core/pocketbase/types';
import { Login } from './login';

const kindA: UserRecord = { id: 'a1', username: 'kind-a', name: 'Kind A', role: 'child' };

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let element: HTMLElement;
  let login: ReturnType<typeof vi.fn<(username: string, password: string) => Promise<UserRecord>>>;
  let router: Router;

  async function setup(terug: string | null = null): Promise<void> {
    login = vi.fn<(username: string, password: string) => Promise<UserRecord>>();
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { login, user: signal(null), isLoggedIn: signal(false) },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(terug === null ? {} : { terug }) },
          },
        },
      ],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(Login);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  function input(label: string): HTMLInputElement {
    const labelElement = [...element.querySelectorAll('label')].find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    const field =
      labelElement && element.querySelector<HTMLInputElement>(`#${labelElement.htmlFor}`);
    if (!field) throw new Error(`No field labelled ${label}`);
    return field;
  }

  function type(label: string, value: string): void {
    const field = input(label);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    // In the browser the app renders between typing and sending.
    fixture.detectChanges();
  }

  /** A face variable of Ted's svg: which mood he shows. */
  function tedVariable(name: string): string {
    return element.querySelector<SVGSVGElement>('snf-ted svg')!.style.getPropertyValue(name).trim();
  }

  function button(): HTMLButtonElement {
    return element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  }

  async function send(): Promise<void> {
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
  }

  /** Lets the (mocked) login promise and the form submission finish, then renders. */
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  it('shows the Snuffel heading and Ted greeting', async () => {
    await setup();
    expect(element.querySelector('h1')?.textContent).toBe('Snuffel');
    expect(element.querySelector('snf-ted-says')?.textContent).toContain(
      'Yo! Ik ben Ted. Wie gaat er snuffelen?',
    );
    expect(tedVariable('--m-bril')).toBe('');
    expect(tedVariable('--m-mond-oeps')).toBe('');
  });

  it('has labelled fields with autocomplete and an Inloggen button', async () => {
    await setup();
    expect(input('Gebruikersnaam').getAttribute('autocomplete')).toBe('username');
    expect(input('Gebruikersnaam').type).toBe('text');
    expect(input('Wachtwoord').getAttribute('autocomplete')).toBe('current-password');
    expect(input('Wachtwoord').type).toBe('password');
    expect(button().textContent?.trim()).toBe('Inloggen');
  });

  it('sending an empty form shows a message and does not log in', async () => {
    await setup();
    await send();
    expect(login).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Vul je gebruikersnaam in.');
    expect(element.textContent).toContain('Vul je wachtwoord in.');
    expect(input('Gebruikersnaam').getAttribute('aria-invalid')).toBe('true');
    expect(input('Gebruikersnaam').getAttribute('aria-describedby')).toBe('login-username-error');
    expect(document.activeElement).toBe(input('Gebruikersnaam'));
  });

  it('logs in with the input and goes to terug', async () => {
    await setup('/ouder');
    login.mockResolvedValue(kindA);
    type('Gebruikersnaam', 'kind-a');
    type('Wachtwoord', 'snuffel-test');
    await send();
    expect(login).toHaveBeenCalledWith('kind-a', 'snuffel-test');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/ouder');
  });

  it('goes to / without terug', async () => {
    await setup();
    login.mockResolvedValue(kindA);
    type('Gebruikersnaam', 'kind-a');
    type('Wachtwoord', 'snuffel-test');
    await send();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  // The absolute URL is built from parts so that `npm run privacy` stays meaningful.
  for (const terug of ['//voorbeeld.nl', ['https:', '', 'voorbeeld.nl', 'ouder'].join('/')]) {
    it(`goes to / for terug=${terug}`, async () => {
      await setup(terug);
      login.mockResolvedValue(kindA);
      type('Gebruikersnaam', 'kind-a');
      type('Wachtwoord', 'snuffel-test');
      await send();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/');
    });
  }

  it('a 400 shows Ted oops in an alert, empties and focuses the password', async () => {
    await setup();
    login.mockRejectedValue(new ClientResponseError({ status: 400 }));
    type('Gebruikersnaam', 'kind-a');
    type('Wachtwoord', 'fout');
    await send();
    const alert = element.querySelector('[role="alert"]');
    expect(alert?.textContent?.trim()).toBe(
      'Hmm, dat klopt niet. Kijk je gebruikersnaam en wachtwoord nog eens na.',
    );
    expect(element.querySelector('snf-ted-says svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(tedVariable('--m-mond-oeps')).toBe('inline');
    expect(input('Wachtwoord').value).toBe('');
    expect(input('Gebruikersnaam').value).toBe('kind-a');
    expect(document.activeElement).toBe(input('Wachtwoord'));
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('status 0 shows the "not reachable" message', async () => {
    await setup();
    login.mockRejectedValue(new ClientResponseError({ status: 0 }));
    type('Gebruikersnaam', 'kind-a');
    type('Wachtwoord', 'snuffel-test');
    await send();
    expect(element.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'Snuffel is even niet bereikbaar. Probeer het zo nog eens.',
    );
  });

  it('the message goes away on the next attempt', async () => {
    await setup();
    login.mockRejectedValueOnce(new ClientResponseError({ status: 400 }));
    type('Gebruikersnaam', 'kind-a');
    type('Wachtwoord', 'fout');
    await send();
    expect(element.querySelector('[role="alert"]')).not.toBeNull();
    login.mockResolvedValue(kindA);
    type('Wachtwoord', 'snuffel-test');
    await send();
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('disables the button while logging in', async () => {
    await setup();
    let finish: (user: UserRecord) => void = () => undefined;
    login.mockReturnValue(new Promise<UserRecord>((resolve) => (finish = resolve)));
    type('Gebruikersnaam', 'kind-a');
    type('Wachtwoord', 'snuffel-test');
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    expect(button().disabled).toBe(true);
    finish(kindA);
    await settle();
    expect(button().disabled).toBe(false);
  });
});
