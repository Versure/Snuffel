import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { TedSays } from '../../shared/ui/ted-says/ted-says';

/** Placeholder start page until M11: Ted greets whoever is logged in. */
@Component({
  selector: 'snf-home',
  imports: [TedSays],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  protected readonly user = inject(AuthService).user;
}
