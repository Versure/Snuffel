import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LessonContext } from '../../lesson-context/lesson-context';
import { GlossaryTerm } from './glossary-term';

@Component({
  imports: [GlossaryTerm],
  template: `<p>Je draait een <snf-glossary-term term="shad" text="shad" /> binnen.</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {}

describe('GlossaryTerm', () => {
  async function render(withContext = true) {
    TestBed.configureTestingModule({ providers: withContext ? [LessonContext] : [] });
    if (withContext) {
      TestBed.inject(LessonContext).glossary.set([
        { term: 'shad', definition: 'kunstaas in de vorm van een **visje** en [[shad]]' },
      ]);
    }
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    document.body.appendChild(element);
    return { fixture, element };
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('toggles the definition and aria-expanded', async () => {
    const { fixture, element } = await render();
    const button = element.querySelector('button');
    if (!button) throw new Error('no button');
    expect(button.textContent?.trim()).toBe('shad');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    const definition = element.querySelector<HTMLElement>(
      `#${button.getAttribute('aria-controls') ?? 'none'}`,
    );
    expect(definition?.hidden).toBe(true);

    button.click();
    await fixture.whenStable();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(definition?.hidden).toBe(false);
    expect(definition?.textContent).toContain('kunstaas in de vorm van een visje en shad');
    expect(definition?.querySelector('strong:not(.definition-term)')?.textContent).toBe('visje');
    // Inside the balloon a term is plain text, not another button.
    expect(definition?.querySelector('button')).toBeNull();

    button.click();
    await fixture.whenStable();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(definition?.hidden).toBe(true);
  });

  it('closes on Escape and keeps focus', async () => {
    const { fixture, element } = await render();
    const button = element.querySelector('button');
    if (!button) throw new Error('no button');
    button.focus();
    button.click();
    await fixture.whenStable();
    expect(button.getAttribute('aria-expanded')).toBe('true');

    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('is plain text without a definition in the context', async () => {
    const { element } = await render(false);
    expect(element.querySelector('button')).toBeNull();
    expect(element.textContent).toBe('Je draait een shad binnen.');
  });

  it('gives every term its own definition id', async () => {
    const { element } = await render();
    const second = TestBed.createComponent(Host);
    await second.whenStable();
    const first = element.querySelector('button')?.getAttribute('aria-controls');
    const other = (second.nativeElement as HTMLElement)
      .querySelector('button')
      ?.getAttribute('aria-controls');
    expect(first).toBeTruthy();
    expect(other).toBeTruthy();
    expect(first).not.toBe(other);
  });
});
