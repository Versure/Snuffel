import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { ClientResponseError } from 'pocketbase';
import { AuthService } from '../../core/auth/auth.service';
import { safeReturnUrl } from '../../core/auth/safe-return-url';
import { Button } from '../../shared/ui/button/button';
import { Card } from '../../shared/ui/card/card';
import { TedSays } from '../../shared/ui/ted-says/ted-says';

interface Credentials {
  username: string;
  password: string;
}

type LoginProblem = 'invalid' | 'unreachable';

/** Server answers that mean "try again later" rather than "wrong username or password". */
function isUnreachable(error: unknown): boolean {
  return (
    error instanceof ClientResponseError &&
    (error.status === 0 || error.status === 429 || error.status >= 500)
  );
}

@Component({
  selector: 'snf-login',
  imports: [Button, Card, FormField, TedSays],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly passwordInput = viewChild.required<ElementRef<HTMLInputElement>>('password');

  protected readonly credentials = signal<Credentials>({ username: '', password: '' });
  protected readonly loginForm = form(this.credentials, (path) => {
    required(path.username, { message: 'Vul je gebruikersnaam in.' });
    required(path.password, { message: 'Vul je wachtwoord in.' });
  });

  protected readonly problem = signal<LoginProblem | null>(null);
  protected readonly tedMood = computed(() => (this.problem() ? 'oops' : 'cool'));

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.problem.set(null);
    await submit(this.loginForm, {
      action: async () => {
        const { username, password } = this.credentials();
        try {
          await this.auth.login(username, password);
        } catch (error) {
          this.problem.set(isUnreachable(error) ? 'unreachable' : 'invalid');
          this.credentials.update((value) => ({ ...value, password: '' }));
          this.passwordInput().nativeElement.focus();
          return undefined;
        }
        const terug = this.route.snapshot.queryParamMap.get('terug');
        await this.router.navigateByUrl(safeReturnUrl(terug));
        return undefined;
      },
      onInvalid: () => {
        const first = this.loginForm.username().invalid()
          ? this.loginForm.username
          : this.loginForm.password;
        first().focusBoundControl();
      },
    });
  }
}
