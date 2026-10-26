import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Fraction } from './fraction';

@Component({
  imports: [Fraction],
  template: `<p>
    Neem
    <snf-fraction
      [numerator]="numerator()"
      [denominator]="denominator()"
      [whole]="whole()"
      [negative]="negative()"
    />
    liter.
  </p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly numerator = signal('1');
  readonly denominator = signal('5');
  readonly whole = signal<string | undefined>(undefined);
  readonly negative = signal(false);
}

const MATHML = 'http://www.w3.org/1998/Math/MathML';

describe('Fraction', () => {
  async function render(change?: (host: Host) => void) {
    const fixture = TestBed.createComponent(Host);
    change?.(fixture.componentInstance);
    await fixture.whenStable();
    return (fixture.nativeElement as HTMLElement).querySelector('snf-fraction') as HTMLElement;
  }

  const hidden = (element: HTMLElement) =>
    element.querySelector('.snf-visually-hidden')?.textContent;
  const texts = (element: Element, selector: string) =>
    [...element.querySelectorAll(selector)].map((node) => node.textContent?.trim());

  it('says the fraction in words for a screen reader', async () => {
    expect(hidden(await render())).toBe('1 vijfde');
    expect(hidden(await render((host) => host.whole.set('1')))).toBe('1 en 1 vijfde');
    expect(hidden(await render((host) => host.negative.set(true)))).toBe('min 1 vijfde');
    expect(
      hidden(
        await render((host) => {
          host.numerator.set('3');
          host.denominator.set('2');
        }),
      ),
    ).toBe('3 halve');
  });

  it('hides the MathML from a screen reader', async () => {
    const math = (await render()).querySelector('math');
    expect(math).not.toBeNull();
    expect(math?.namespaceURI).toBe(MATHML);
    expect(math?.getAttribute('aria-hidden')).toBe('true');
  });

  it('stacks the numerator above the denominator in an mfrac', async () => {
    const element = await render((host) => {
      host.numerator.set('3');
      host.denominator.set('4');
    });
    const mfrac = element.querySelector('math > mfrac');
    expect(mfrac?.namespaceURI).toBe(MATHML);
    expect(mfrac?.children.length).toBe(2);
    expect(texts(mfrac as Element, ':scope > mn')).toEqual(['3', '4']);
    expect(element.querySelector('math > mn')).toBeNull();
    expect(element.querySelector('mo')).toBeNull();
  });

  it('puts the whole number before the fraction, and a minus only when negative', async () => {
    const mixed = await render((host) => {
      host.whole.set('1');
      host.numerator.set('1');
      host.denominator.set('4');
    });
    const math = mixed.querySelector('math') as Element;
    expect([...math.children].map((child) => child.localName)).toEqual(['mn', 'mfrac']);
    expect(texts(math, ':scope > mn')).toEqual(['1']);
    expect(mixed.querySelector('mo')).toBeNull();

    const negative = await render((host) => host.negative.set(true));
    const negativeMath = negative.querySelector('math') as Element;
    expect([...negativeMath.children].map((child) => child.localName)).toEqual(['mo', 'mfrac']);
    expect(texts(negativeMath, ':scope > mo')).toEqual(['−']);
  });
});
