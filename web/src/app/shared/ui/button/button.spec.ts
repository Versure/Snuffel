import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Button, ButtonVariant } from './button';

@Component({
  imports: [Button],
  template: `
    <button snf-button type="button" [variant]="variant()">Verder</button>
    <a snf-button href="#start">Start</a>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly variant = signal<ButtonVariant>('purple');
}

describe('Button', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      button: root.querySelector('button') as HTMLButtonElement,
      link: root.querySelector('a') as HTMLAnchorElement,
    };
  }

  it('is purple by default', async () => {
    const { link } = await render();
    expect(link.classList).toContain('snf-button');
    expect(link.classList).toContain('snf-button--purple');
  });

  it('follows the variant', async () => {
    const { fixture, button } = await render();
    for (const variant of ['pink', 'light', 'purple'] as const) {
      fixture.componentInstance.variant.set(variant);
      await fixture.whenStable();
      expect(button.classList).toContain(`snf-button--${variant}`);
      expect(button.classList.length).toBe(2);
    }
  });

  it('projects its content', async () => {
    const { button, link } = await render();
    expect(button.textContent?.trim()).toBe('Verder');
    expect(link.textContent?.trim()).toBe('Start');
  });

  it('keeps the native element and attributes', async () => {
    const { button, link } = await render();
    expect(button.tagName).toBe('BUTTON');
    expect(button.type).toBe('button');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('#start');
  });
});
