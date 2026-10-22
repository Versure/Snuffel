import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from '../button/button';

/** The bar at the top for whoever is logged in: their name and a logout button. */
@Component({
  selector: 'snf-top-bar',
  imports: [Button],
  templateUrl: './top-bar.html',
  styleUrl: './top-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopBar {
  readonly name = input.required<string>();
  readonly logout = output();
}
