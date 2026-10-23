import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Source } from '../../../core/content/content.types';
import { LessonContext } from '../../lesson-context/lesson-context';
import { SourceRefs } from './source-refs';

const base = ['https', '://example.org/'].join('');
const sources: Source[] = [
  {
    id: 'svnl',
    title: 'Roofvissen met kunstaas',
    url: `${base}svnl`,
    publisher: 'Sportvisserij Nederland',
    type: 'association',
    reliability: 'high',
    accessedOn: '2026-10-19',
  },
  {
    id: 'winkel',
    title: 'Snoekkunstaas',
    url: `${base}winkel`,
    publisher: 'Decathlon',
    type: 'shop',
    reliability: 'low',
    accessedOn: '2026-10-19',
  },
];

@Component({
  imports: [SourceRefs],
  template: `<snf-source-refs [refs]="refs()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly refs = signal<readonly string[]>([]);
}

describe('SourceRefs', () => {
  async function render(refs: readonly string[], withContext = true) {
    TestBed.configureTestingModule({ providers: withContext ? [LessonContext] : [] });
    if (withContext) TestBed.inject(LessonContext).sources.set(sources);
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.refs.set(refs);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows Bron: with a link per source, named after the publisher', async () => {
    const element = await render(['svnl', 'winkel']);
    const text = element.querySelector('.sources')?.textContent?.replace(/\s+/g, ' ').trim();
    expect(text).toBe(
      'Bron: Sportvisserij Nederland (opent in een nieuw tabblad), Decathlon (opent in een nieuw tabblad)',
    );
    const links = [...element.querySelectorAll('a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      `${base}svnl`,
      `${base}winkel`,
    ]);
    expect(links[0].getAttribute('aria-label')).toBe(
      'Bron: Roofvissen met kunstaas (Sportvisserij Nederland) (opent in een nieuw tabblad)',
    );
    expect(links.every((link) => link.rel === 'noopener noreferrer')).toBe(true);
  });

  it('shows nothing for an empty list', async () => {
    const element = await render([]);
    expect(element.querySelector('.sources')).toBeNull();
    expect(element.textContent?.trim()).toBe('');
  });

  it('shows nothing without a lesson context or for an unknown id', async () => {
    expect((await render(['svnl'], false)).querySelector('.sources')).toBeNull();
    TestBed.resetTestingModule();
    expect((await render(['onbekend'])).querySelector('.sources')).toBeNull();
  });
});
