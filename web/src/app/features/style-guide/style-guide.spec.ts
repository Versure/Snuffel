import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TED_MOODS } from '../../shared/ui/ted/ted';
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

  it('shows Ted in four moods with their own labels', async () => {
    const { element } = await render();
    const heading = element.querySelector('h2#ted');
    expect(heading?.textContent).toBe('Ted');

    const labelled = Array.from(element.querySelectorAll('snf-ted svg[role="img"]'));
    expect(labelled.map((svg) => svg.getAttribute('aria-label'))).toEqual([
      TED_MOODS.cool.label,
      TED_MOODS.happy.label,
      TED_MOODS.thinking.label,
      TED_MOODS.oops.label,
    ]);
    for (const label of ['Stoer', 'Blij', 'Nadenkend', 'Oeps']) {
      expect(element.textContent, label).toContain(label);
    }

    const small = Array.from(element.querySelectorAll('.moods snf-ted.snf-ted--small svg'));
    expect(small).toHaveLength(4);
    for (const svg of small) expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(element.querySelector('.moods--small')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows a speech bubble with each tail and two ted-says', async () => {
    const { element } = await render();
    const bubbles = element.querySelectorAll('.bubbles snf-speech-bubble');
    expect(bubbles).toHaveLength(2);
    expect(bubbles[0]?.classList).toContain('snf-speech-bubble--left');
    expect(bubbles[1]?.classList).toContain('snf-speech-bubble--bottom');

    const says = Array.from(element.querySelectorAll('snf-ted-says'));
    expect(says).toHaveLength(2);
    expect(says[0]?.textContent).toContain('Yo! Ik ben Ted.');
    expect(says[0]?.querySelector('snf-ted')?.classList).toContain('snf-ted--wiggle');
    expect(says[1]?.textContent).toContain('Voel mee');
    expect(says[1]?.querySelector('snf-ted')?.classList).toContain('snf-ted--small');
  });
});
