import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'snf-band',
  templateUrl: './band.html',
  styleUrl: './band.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Band {}
