import { TestBed } from '@angular/core/testing';
import { TED_MOODS, Ted, type TedMood } from './ted';

const ALL_VARIABLES = [
  '--m-bril',
  '--m-ogen-blij',
  '--m-ogen-denk',
  '--m-mond-blij',
  '--m-mond-denk',
  '--m-mond-oeps',
];

async function render(inputs: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(Ted);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const svg = host.querySelector('svg');
  if (!svg) throw new Error('svg not found');
  return { fixture, host, svg };
}

function variables(svg: SVGSVGElement): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of ALL_VARIABLES) {
    const value = svg.style.getPropertyValue(name).trim();
    if (value) result[name] = value;
  }
  return result;
}

describe('Ted', () => {
  it('shows the cool mood: no variables, sunglasses label', async () => {
    const { svg } = await render({ mood: 'cool' });
    expect(variables(svg)).toEqual({});
    expect(svg.getAttribute('aria-label')).toBe('Ted, een pluizige bruine pup met zonnebril');
  });

  it('shows the happy mood', async () => {
    const { svg } = await render({ mood: 'happy' });
    expect(variables(svg)).toEqual({ '--m-bril': 'none', '--m-ogen-blij': 'inline' });
    expect(svg.getAttribute('aria-label')).toBe('Ted, een pluizige bruine pup, kijkt blij');
  });

  it('shows the thinking mood', async () => {
    const { svg } = await render({ mood: 'thinking' });
    expect(variables(svg)).toEqual({
      '--m-bril': 'none',
      '--m-ogen-denk': 'inline',
      '--m-mond-blij': 'none',
      '--m-mond-denk': 'inline',
    });
    expect(svg.getAttribute('aria-label')).toBe('Ted, een pluizige bruine pup, denkt na');
  });

  it('shows the oops mood', async () => {
    const { svg } = await render({ mood: 'oops' });
    expect(variables(svg)).toEqual({
      '--m-bril': 'none',
      '--m-ogen-denk': 'inline',
      '--m-mond-blij': 'none',
      '--m-mond-oeps': 'inline',
    });
    expect(svg.getAttribute('aria-label')).toBe('Ted, een pluizige bruine pup, kijkt geschrokken');
  });

  it('is cool by default', async () => {
    const { svg } = await render();
    expect(variables(svg)).toEqual({});
    expect(svg.getAttribute('aria-label')).toBe(TED_MOODS.cool.label);
  });

  it('drops the variables of the previous mood when the mood changes', async () => {
    const { fixture, svg } = await render({ mood: 'oops' });
    fixture.componentRef.setInput('mood', 'happy');
    await fixture.whenStable();
    expect(variables(svg)).toEqual(TED_MOODS.happy.variables);
    fixture.componentRef.setInput('mood', 'cool' satisfies TedMood);
    await fixture.whenStable();
    expect(variables(svg)).toEqual({});
  });

  it('is an image with a label when not decorative', async () => {
    const { svg } = await render();
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.hasAttribute('aria-hidden')).toBe(false);
  });

  it('is hidden without role or label when decorative', async () => {
    const { svg } = await render({ decorative: true, mood: 'happy' });
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.hasAttribute('role')).toBe(false);
    expect(svg.hasAttribute('aria-label')).toBe(false);
  });

  it('follows the size input with a host class', async () => {
    const { fixture, host } = await render();
    expect(host.classList).toContain('snf-ted--large');
    expect(host.classList).not.toContain('snf-ted--small');
    fixture.componentRef.setInput('size', 'small');
    await fixture.whenStable();
    expect(host.classList).toContain('snf-ted--small');
    expect(host.classList).not.toContain('snf-ted--large');
  });

  it('does not wiggle by default', async () => {
    const { host } = await render();
    expect(host.classList).not.toContain('snf-ted--wiggle');
  });

  it('wiggles with the wiggle input', async () => {
    const { host } = await render({ wiggle: true });
    expect(host.classList).toContain('snf-ted--wiggle');
  });

  it('uses the sprite from the own server', async () => {
    const { svg } = await render();
    expect(svg.querySelector('use')?.getAttribute('href')).toBe('/assets/ted.svg#ted');
  });
});
