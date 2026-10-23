import { afterNextRender, DestroyRef, Directive, ElementRef, inject, output } from '@angular/core';

/**
 * Tells once that its element came into view (IntersectionObserver), for example a marker at the
 * end of an explanation: read to the end. Without IntersectionObserver it does nothing.
 */
@Directive({ selector: '[snfSeen]' })
export class Seen {
  readonly seen = output<void>();

  constructor() {
    const element = inject<ElementRef<Element>>(ElementRef).nativeElement;
    let observer: IntersectionObserver | null = null;
    let destroyed = false;

    afterNextRender(() => {
      if (destroyed || typeof IntersectionObserver === 'undefined') return;
      observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer?.disconnect();
        observer = null;
        this.seen.emit();
      });
      observer.observe(element);
    });

    inject(DestroyRef).onDestroy(() => {
      destroyed = true;
      observer?.disconnect();
      observer = null;
    });
  }
}
