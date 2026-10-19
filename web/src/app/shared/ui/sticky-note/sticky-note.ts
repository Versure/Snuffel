import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'snf-sticky-note',
  templateUrl: './sticky-note.html',
  styleUrl: './sticky-note.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StickyNote {}
