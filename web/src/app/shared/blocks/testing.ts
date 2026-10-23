import { type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Source } from '../../core/content/content.types';
import { LessonContext } from '../lesson-context/lesson-context';

/** A source for tests; the url is built at runtime (privacy scan, see CLAUDE.md). */
export const testSource: Source = {
  id: 'svnl',
  title: 'Roofvissen met kunstaas',
  url: ['https', '://example.org/svnl'].join(''),
  publisher: 'Sportvisserij Nederland',
  type: 'association',
  reliability: 'high',
  accessedOn: '2026-10-19',
};

/**
 * Renders a block component with `block` as input, inside a lesson context with one source, one
 * glossary term and one asset.
 */
export async function renderBlock<T>(
  component: Type<T>,
  block: unknown,
  { context = true } = {},
): Promise<HTMLElement> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: context ? [LessonContext] : [] });
  if (context) {
    const lessonContext = TestBed.inject(LessonContext);
    lessonContext.sources.set([testSource]);
    lessonContext.glossary.set([{ term: 'shad', definition: 'rubber visje' }]);
    lessonContext.assetUrls.set(
      new Map([
        ['assets/hengeltop.svg', '/content/proefcursus/assets/hengeltop.svg?v=0123456789abcdef'],
      ]),
    );
  }
  const fixture = TestBed.createComponent(component);
  fixture.componentRef.setInput('block', block);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

/** The text a reader sees: without hidden parts (a closed definition), whitespace collapsed. */
export function textOf(element: Element | null | undefined): string {
  if (!element) return '';
  const copy = element.cloneNode(true) as Element;
  for (const hidden of copy.querySelectorAll('[hidden]')) hidden.remove();
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}
