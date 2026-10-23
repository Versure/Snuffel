import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Seen } from './seen';

@Component({
  imports: [Seen],
  template: `@if (shown()) {
    <div class="marker" snfSeen (seen)="count = count + 1"></div>
  }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly shown = signal(true);
  count = 0;
}

/** A stand-in for IntersectionObserver that the test triggers by hand. */
class FakeObserver {
  static instances: FakeObserver[] = [];
  readonly observed: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeObserver.instances.push(this);
  }

  observe(element: Element): void {
    this.observed.push(element);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  trigger(isIntersecting: boolean): void {
    if (this.disconnected) return;
    const entries = this.observed.map((target) => ({ target, isIntersecting }));
    this.callback(
      entries as unknown as IntersectionObserverEntry[],
      this as unknown as IntersectionObserver,
    );
  }
}

describe('Seen', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeObserver.instances = [];
  });

  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return fixture;
  }

  it('emits once when the element comes into view', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    const fixture = await render();
    const [observer] = FakeObserver.instances;
    expect(observer.observed).toEqual([fixture.nativeElement.querySelector('.marker')]);

    observer.trigger(false);
    expect(fixture.componentInstance.count).toBe(0);
    observer.trigger(true);
    expect(fixture.componentInstance.count).toBe(1);
    expect(observer.disconnected).toBe(true);
    observer.trigger(true);
    expect(fixture.componentInstance.count).toBe(1);
  });

  it('disconnects on destroy', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    const fixture = await render();
    const [observer] = FakeObserver.instances;
    fixture.componentInstance.shown.set(false);
    await fixture.whenStable();
    expect(observer.disconnected).toBe(true);
    expect(fixture.componentInstance.count).toBe(0);
  });

  it('does nothing without IntersectionObserver', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const fixture = await render();
    expect(fixture.componentInstance.count).toBe(0);
    expect(FakeObserver.instances).toEqual([]);
    fixture.destroy();
  });
});
