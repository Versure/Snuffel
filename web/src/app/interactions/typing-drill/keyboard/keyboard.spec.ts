import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { TypingKey } from '../../../core/content/content.types';
import { KEYBOARD_ROWS, type KeyPress } from '../keyboard-layout';
import { TypingKeyboard } from './keyboard';

describe('TypingKeyboard', () => {
  async function render(
    next: KeyPress | null,
    newKeys: readonly TypingKey[] = [],
  ): Promise<{ fixture: ComponentFixture<TypingKeyboard>; element: HTMLElement }> {
    const fixture = TestBed.createComponent(TypingKeyboard);
    fixture.componentRef.setInput('next', next);
    fixture.componentRef.setInput('newKeys', newKeys);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  const key = (element: HTMLElement, id: string) =>
    element.querySelector<HTMLElement>(`.key[data-key="${CSS.escape(id)}"]`);

  it('every key has the colour class of its finger', async () => {
    const { element } = await render(null);
    const keys = element.querySelectorAll('.key');
    expect(keys.length).toBe(KEYBOARD_ROWS.flat().length);
    expect(key(element, 'a')?.classList).toContain('finger-pinky');
    expect(key(element, 's')?.classList).toContain('finger-ring');
    expect(key(element, 'd')?.classList).toContain('finger-middle');
    expect(key(element, 'f')?.classList).toContain('finger-index');
    expect(key(element, 'j')?.classList).toContain('finger-index');
    expect(key(element, ';')?.classList).toContain('finger-pinky');
    expect(key(element, '6')?.classList).toContain('finger-index');
    expect(key(element, 'space')?.classList).toContain('finger-thumb');
    expect(key(element, 'shift-left')?.classList).toContain('finger-pinky');
    expect(key(element, 'tab')?.classList).toContain('empty');
    for (const item of keys) {
      const fingers = [...item.classList].filter((name) => name.startsWith('finger-'));
      expect(fingers.length + (item.classList.contains('empty') ? 1 : 0)).toBe(1);
    }
  });

  it('the next key and the shift on the other hand are marked', async () => {
    const { fixture, element } = await render({ key: 'f', shift: null });
    expect(
      [...element.querySelectorAll('.next')].map((item) => item.getAttribute('data-key')),
    ).toEqual(['f']);
    fixture.componentRef.setInput('next', { key: 'a', shift: 'right' });
    await fixture.whenStable();
    expect(
      [...element.querySelectorAll('.next')].map((item) => item.getAttribute('data-key')).sort(),
    ).toEqual(['a', 'shift-right']);
    fixture.componentRef.setInput('next', null);
    await fixture.whenStable();
    expect(element.querySelectorAll('.next').length).toBe(0);
  });

  it('a new key has a star and the line Nieuw: …', async () => {
    const { element } = await render(null, ['g', 'h']);
    expect(key(element, 'g')?.classList).toContain('new');
    expect(key(element, 'g')?.querySelector('.star')?.textContent).toBe('★');
    expect(key(element, 'h')?.querySelector('.star')).not.toBeNull();
    expect(key(element, 'f')?.querySelector('.star')).toBeNull();
    expect(element.querySelector('.new-keys')?.textContent?.trim()).toBe('★ Nieuw: g en h');
    const { element: plain } = await render(null, []);
    expect(plain.querySelector('.new-keys')).toBeNull();
  });

  it('the legend marks the finger of the next key', async () => {
    const { fixture, element } = await render({ key: 'f', shift: null });
    const names = [...element.querySelectorAll('.legend .finger')].map((item) =>
      item.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(names).toEqual(['pink', 'ringvinger', 'middelvinger', 'wijsvinger ← nu', 'duim']);
    expect(element.querySelectorAll('.legend .now').length).toBe(1);
    fixture.componentRef.setInput('next', { key: 'l', shift: 'left' });
    await fixture.whenStable();
    expect(
      [...element.querySelectorAll('.legend .now')].map((item) =>
        item.textContent?.replace(/\s+/g, ' ').trim(),
      ),
    ).toEqual(['pink ← nu', 'ringvinger ← nu']);
  });

  it('the next key is also written as text', async () => {
    const { fixture, element } = await render({ key: 'f', shift: null });
    const line = element.querySelector('.next-key');
    expect(line?.textContent?.trim()).toBe('Volgende toets: f, linkerwijsvinger');
    expect(line?.closest('[aria-hidden="true"]')).toBeNull();
    fixture.componentRef.setInput('next', { key: 'a', shift: 'right' });
    await fixture.whenStable();
    expect(element.querySelector('.next-key')?.textContent?.trim()).toBe(
      'Volgende toets: Shift rechts + a, rechterpink en linkerpink',
    );
  });

  it('the drawn keyboard is hidden from a screen reader', async () => {
    const { element } = await render({ key: 'f', shift: null }, ['f']);
    expect(element.querySelector('.keyboard')?.getAttribute('aria-hidden')).toBe('true');
    for (const swatch of element.querySelectorAll('.swatch')) {
      expect(swatch.getAttribute('aria-hidden')).toBe('true');
    }
    expect(element.querySelector('.new-keys .star')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('no hover style carries information', async () => {
    await render({ key: 'f', shift: null });
    const styles = [...document.querySelectorAll('style')]
      .map((style) => style.textContent ?? '')
      .filter((text) => text.includes('.finger-index') && text.includes('.next'));
    expect(styles.length).toBeGreaterThan(0);
    for (const text of styles) expect(text).not.toContain(':hover');
  });
});
