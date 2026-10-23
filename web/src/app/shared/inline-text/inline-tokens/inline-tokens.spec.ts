import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { parseInline, type InlineToken } from '../inline-markup';
import { LessonContext } from '../../lesson-context/lesson-context';
import { InlineTokens } from './inline-tokens';

@Component({
  imports: [InlineTokens],
  template: `<p><snf-inline-tokens [tokens]="tokens()" [terms]="terms()" /></p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly tokens = signal<readonly InlineToken[]>([]);
  readonly terms = signal(true);
}

describe('InlineTokens', () => {
  async function render(tokens: readonly InlineToken[], terms = true) {
    TestBed.configureTestingModule({ providers: [LessonContext] });
    TestBed.inject(LessonContext).glossary.set([{ term: 'shad', definition: 'rubber visje' }]);
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.tokens.set(tokens);
    fixture.componentInstance.terms.set(terms);
    await fixture.whenStable();
    return (fixture.nativeElement as HTMLElement).querySelector('p') as HTMLElement;
  }

  it('renders nested tokens recursively', async () => {
    const p = await render(parseInline('Een **echt *heel* mooie [[shad]]** hier.'));
    const strong = p.querySelector('strong');
    expect(strong?.querySelector('em')?.textContent).toBe('heel');
    expect(strong?.querySelector('button')?.textContent?.trim()).toBe('shad');
    expect(p.textContent?.startsWith('Een echt heel mooie')).toBe(true);
    expect(p.textContent?.endsWith(' hier.')).toBe(true);
  });

  it('passes terms down to nested tokens', async () => {
    const p = await render(parseInline('**[[shad]]** en *[[shad]]*'), false);
    expect(p.querySelector('button')).toBeNull();
    expect(p.textContent).toBe('shad en shad');
  });

  it('renders nothing for no tokens', async () => {
    const p = await render([]);
    expect(p.textContent).toBe('');
  });
});
