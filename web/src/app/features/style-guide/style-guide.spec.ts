import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StyleGuide } from './style-guide';

describe('StyleGuide', () => {
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    root = TestBed.inject(DOCUMENT).documentElement;
    root.removeAttribute('data-theme');
  });

  afterEach(() => root.removeAttribute('data-theme'));

  async function render() {
    const fixture = TestBed.createComponent(StyleGuide);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const themeButton = (label: string): HTMLButtonElement => {
      const button = Array.from(
        element.querySelectorAll<HTMLButtonElement>('[role="group"] button'),
      ).find((candidate) => candidate.textContent?.trim() === label);
      if (!button) throw new Error(`theme button ${label} not found`);
      return button;
    };
    const click = async (label: string) => {
      themeButton(label).click();
      await fixture.whenStable();
    };
    return { fixture, element, themeButton, click };
  }

  it('starts on the system theme without an attribute', async () => {
    const { themeButton } = await render();
    expect(root.hasAttribute('data-theme')).toBe(false);
    expect(themeButton('Systeem').getAttribute('aria-pressed')).toBe('true');
    expect(themeButton('Licht').getAttribute('aria-pressed')).toBe('false');
    expect(themeButton('Donker').getAttribute('aria-pressed')).toBe('false');
  });

  it('sets data-theme="dark" for "Donker"', async () => {
    const { click, themeButton } = await render();
    await click('Donker');
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(themeButton('Donker').getAttribute('aria-pressed')).toBe('true');
    expect(themeButton('Systeem').getAttribute('aria-pressed')).toBe('false');
  });

  it('sets data-theme="light" for "Licht"', async () => {
    const { click, themeButton } = await render();
    await click('Licht');
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(themeButton('Licht').getAttribute('aria-pressed')).toBe('true');
    expect(themeButton('Donker').getAttribute('aria-pressed')).toBe('false');
  });

  it('removes the attribute for "Systeem"', async () => {
    const { click, themeButton } = await render();
    await click('Donker');
    await click('Systeem');
    expect(root.hasAttribute('data-theme')).toBe(false);
    expect(themeButton('Systeem').getAttribute('aria-pressed')).toBe('true');
  });

  it('removes the attribute when the page is destroyed', async () => {
    const { fixture, click } = await render();
    await click('Donker');
    fixture.destroy();
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('shows all house style components', async () => {
    const { element } = await render();
    for (const selector of [
      'h1 snf-band',
      'h2',
      'snf-card',
      'snf-sticker',
      'snf-sticky-note',
      '.swatch',
      'button.snf-button--purple',
      'button.snf-button--pink',
      'button.snf-button--light',
      'button[disabled]',
      'a[href$="#kleuren"]',
    ]) {
      expect(element.querySelector(selector), selector).not.toBeNull();
    }
  });
});
