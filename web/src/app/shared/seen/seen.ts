import {
  afterNextRender,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  numberAttribute,
  output,
} from '@angular/core';

/**
 * Tells once that its element came into view (IntersectionObserver), for example a marker at the
 * end of an explanation: read to the end. With `snfSeenDwell` the element has to stay in view
 * that many milliseconds, so scrolling past it (a smooth jump with the step navigation) does not
 * count. Without IntersectionObserver it does nothing.
 */
@Directive({ selector: '[snfSeen]' })
export class Seen {
  readonly dwell = input(0, { alias: 'snfSeenDwell', transform: numberAttribute });
  readonly seen = output<void>();

  constructor() {
    const element = inject<ElementRef<Element>>(ElementRef).nativeElement;
    let observer: IntersectionObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    const stopTimer = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    const stop = () => {
      stopTimer();
      observer?.disconnect();
      observer = null;
    };
    const done = () => {
      stop();
      this.seen.emit();
    };

    afterNextRender(() => {
      if (destroyed || typeof IntersectionObserver === 'undefined') return;
      observer = new IntersectionObserver((entries) => {
        const inView = entries.some((entry) => entry.isIntersecting);
        if (!inView) {
          stopTimer();
          return;
        }
        const dwell = this.dwell();
        if (dwell <= 0) done();
        else timer ??= setTimeout(done, dwell);
      });
      observer.observe(element);
    });

    inject(DestroyRef).onDestroy(() => {
      destroyed = true;
      stop();
    });
  }
}
