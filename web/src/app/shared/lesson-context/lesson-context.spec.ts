import { TestBed } from '@angular/core/testing';
import type { Source } from '../../core/content/content.types';
import { LessonContext, normalizeTerm } from './lesson-context';

const source: Source = {
  id: 'svnl',
  title: 'Roofvissen',
  url: ['https', '://example.org/roofvissen'].join(''),
  publisher: 'Sportvisserij Nederland',
  type: 'association',
  reliability: 'high',
  accessedOn: '2026-10-19',
};

describe('LessonContext', () => {
  function create(): LessonContext {
    TestBed.configureTestingModule({ providers: [LessonContext] });
    return TestBed.inject(LessonContext);
  }

  it('is empty until the lesson page fills it', () => {
    const context = create();
    expect(context.definition('shad')).toBeUndefined();
    expect(context.source('svnl')).toBeUndefined();
    expect(context.assetUrl('assets/a.svg')).toBeUndefined();
  });

  it('finds a definition case-insensitively, like content:check', () => {
    const context = create();
    context.glossary.set([
      { term: 'VISpas', definition: 'de pas om te vissen' },
      { term: 'shad', definition: 'rubber visje' },
    ]);
    expect(context.definition('VISpas')).toBe('de pas om te vissen');
    expect(context.definition('vispas')).toBe('de pas om te vissen');
    expect(context.definition(' Shad ')).toBe('rubber visje');
    expect(context.definition('loodkop')).toBeUndefined();
    expect(normalizeTerm(' IJsvogel ')).toBe('ijsvogel');
  });

  it('finds a source by id', () => {
    const context = create();
    context.sources.set([source]);
    expect(context.source('svnl')).toEqual(source);
    expect(context.source('andere')).toBeUndefined();
  });

  it('gives the asset url with its hash', () => {
    const context = create();
    context.assetUrls.set(
      new Map([['assets/a.svg', '/content/proefcursus/assets/a.svg?v=0123456789abcdef']]),
    );
    expect(context.assetUrl('assets/a.svg')).toBe(
      '/content/proefcursus/assets/a.svg?v=0123456789abcdef',
    );
    expect(context.assetUrl('assets/b.svg')).toBeUndefined();
  });
});
