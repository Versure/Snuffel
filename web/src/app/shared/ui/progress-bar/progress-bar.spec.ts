import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ProgressBar } from './progress-bar';

@Component({
  imports: [ProgressBar],
  template: `<snf-progress-bar [value]="value()" [max]="max()" [label]="label()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly value = signal(1);
  readonly max = signal(2);
  readonly label = signal('1 van 2 lessen klaar');
}

@Component({
  imports: [ProgressBar],
  template: `<snf-progress-bar
    [value]="0"
    [max]="2"
    label="0 van 2 lessen klaar"
    name="Voortgang Proefcursus"
  />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class NamedHost {}

async function render(value = 1, max = 2, label = '1 van 2 lessen klaar') {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.value.set(value);
  fixture.componentInstance.max.set(max);
  fixture.componentInstance.label.set(label);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const bar = element.querySelector<HTMLElement>('[role="progressbar"]');
  const fill = element.querySelector<HTMLElement>('.fill');
  return { fixture, element, bar, fill };
}

describe('ProgressBar', () => {
  it('has role progressbar with min, max, now and valuetext', async () => {
    const { bar, element } = await render();
    expect(bar?.getAttribute('aria-valuemin')).toBe('0');
    expect(bar?.getAttribute('aria-valuemax')).toBe('2');
    expect(bar?.getAttribute('aria-valuenow')).toBe('1');
    expect(bar?.getAttribute('aria-valuetext')).toBe('1 van 2 lessen klaar');
    // A short fixed name, so the label is read once (as the value text).
    expect(bar?.getAttribute('aria-label')).toBe('Voortgang');
    expect(bar?.hasAttribute('aria-labelledby')).toBe(false);
    // The visible label is hidden from screen readers: they hear it as the value text.
    expect(element.querySelector('.label')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('takes another name when given one', async () => {
    const fixture = TestBed.createComponent(NamedHost);
    await fixture.whenStable();
    const bar = (fixture.nativeElement as HTMLElement).querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-label')).toBe('Voortgang Proefcursus');
    expect(bar?.getAttribute('aria-valuetext')).toBe('0 van 2 lessen klaar');
  });

  it('shows the label as text', async () => {
    const { element } = await render(0, 3, '0 van 3 lessen klaar');
    expect(element.querySelector('.label')?.textContent?.trim()).toBe('0 van 3 lessen klaar');
  });

  it('fills the bar in proportion', async () => {
    const { fill, fixture } = await render(1, 4);
    expect(fill?.style.width).toBe('25%');
    fixture.componentInstance.value.set(2);
    await fixture.whenStable();
    expect(fill?.style.width).toBe('50%');
  });

  it('clamps a value above max and below 0', async () => {
    const above = await render(5, 2);
    expect(above.bar?.getAttribute('aria-valuenow')).toBe('2');
    expect(above.fill?.style.width).toBe('100%');
    above.fixture.destroy();
    const below = await render(-1, 2);
    expect(below.bar?.getAttribute('aria-valuenow')).toBe('0');
    expect(below.fill?.style.width).toBe('0%');
  });

  it('a full bar is completely filled', async () => {
    const { fill, bar } = await render(3, 3, 'Alle lessen klaar!');
    expect(fill?.style.width).toBe('100%');
    expect(bar?.getAttribute('aria-valuenow')).toBe('3');
    expect(bar?.getAttribute('aria-valuetext')).toBe('Alle lessen klaar!');
  });
});
