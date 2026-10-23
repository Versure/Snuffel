import { computed, Injectable, signal } from '@angular/core';
import type { GlossaryEntry, Source } from '../../core/content/content.types';

/** The same normalisation as content:check (tools/content/rules/language.mjs). */
export function normalizeTerm(term: string): string {
  return term.trim().toLocaleLowerCase('nl');
}

/**
 * What the parts of a lesson need from the lesson around them: the glossary, the sources of the
 * course and the urls of the assets. Not provided in root: the lesson page provides and fills it.
 * Components inject it optionally; without a context they render plain text.
 */
@Injectable()
export class LessonContext {
  readonly glossary = signal<readonly GlossaryEntry[]>([]);
  readonly sources = signal<readonly Source[]>([]);
  readonly assetUrls = signal<ReadonlyMap<string, string>>(new Map());

  private readonly definitions = computed(
    () => new Map(this.glossary().map((entry) => [normalizeTerm(entry.term), entry.definition])),
  );
  private readonly sourcesById = computed(
    () => new Map(this.sources().map((source) => [source.id, source])),
  );

  /** The definition of a term from the glossary (case-insensitive), or undefined. */
  definition(term: string): string | undefined {
    return this.definitions().get(normalizeTerm(term));
  }

  /** A source of the course by id, or undefined. */
  source(id: string): Source | undefined {
    return this.sourcesById().get(id);
  }

  /** The url of an asset (`figure.src`) with its hash, or undefined. */
  assetUrl(src: string): string | undefined {
    return this.assetUrls().get(src);
  }
}
