import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'snf-sticker',
  templateUrl: './sticker.html',
  styleUrl: './sticker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sticker {}
