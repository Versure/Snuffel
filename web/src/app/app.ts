import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { TopBar } from './shared/ui/top-bar/top-bar';

@Component({
  selector: 'snf-root',
  imports: [RouterOutlet, TopBar],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly auth = inject(AuthService);

  protected logout(): void {
    void this.auth.logout();
  }
}
