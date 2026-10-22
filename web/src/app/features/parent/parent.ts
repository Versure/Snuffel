import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TedSays } from '../../shared/ui/ted-says/ted-says';

/** Placeholder for the parent overview (M12). */
@Component({
  selector: 'snf-parent',
  imports: [TedSays],
  templateUrl: './parent.html',
  styleUrl: './parent.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Parent {}
