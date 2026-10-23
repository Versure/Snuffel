import { TestBed } from '@angular/core/testing';
import type { SignalIcon as SignalIconName } from '../../../core/content/content.types';
import { SIGNAL_ICONS, SignalIcon } from './signal-icon';

// The set from lesson.schema.json; the Record type keeps SIGNAL_ICONS complete.
const names: SignalIconName[] = [
  'tick',
  'shake',
  'stop',
  'check',
  'cross',
  'question',
  'idea',
  'warning',
];

describe('SignalIcon', () => {
  async function render(name: SignalIconName): Promise<SVGSVGElement> {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(SignalIcon);
    fixture.componentRef.setInput('name', name);
    await fixture.whenStable();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg');
    if (!svg) throw new Error('no svg');
    return svg;
  }

  it('draws every icon of the set', async () => {
    expect(Object.keys(SIGNAL_ICONS).sort()).toEqual([...names].sort());
    const drawings = new Set<string>();
    for (const name of names) {
      const svg = await render(name);
      expect(svg.getAttribute('data-icon')).toBe(name);
      expect(svg.querySelector('rect.tile')).not.toBeNull();
      const paths = [...svg.querySelectorAll('path')].map((path) => path.getAttribute('d'));
      expect(paths.length, name).toBeGreaterThan(0);
      expect(paths.every((d) => d && d.length > 0)).toBe(true);
      drawings.add(paths.join('|'));
    }
    // Every icon has its own drawing.
    expect(drawings.size).toBe(names.length);
  });

  it('uses the colours from the reference for tick, shake and stop', async () => {
    expect((await render('tick')).classList).toContain('icon--yellow');
    expect((await render('shake')).classList).toContain('icon--pink');
    expect((await render('stop')).classList).toContain('icon--lilac');
    expect((await render('stop')).querySelector('.stroke--dashed')).not.toBeNull();
  });

  it('is hidden from assistive technology', async () => {
    for (const name of names) {
      const svg = await render(name);
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.hasAttribute('role')).toBe(false);
      expect(svg.querySelector('title')).toBeNull();
    }
  });
});
