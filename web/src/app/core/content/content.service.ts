import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ContentError } from './content-error';
import type { ContentManifest, Course, Lesson, ManifestCourse } from './content.types';
import { isSupportedSchemaVersion } from './supported-versions';

/** Built content is served by the app's own server (see tools/content/build.mjs). */
const CONTENT_BASE = '/content/';
/** Paths in the manifest: lower-case segments ending in .json, never another host or `..`. */
const SAFE_PATH = /^[a-z0-9-]+(\/[a-z0-9-]+)*\.json$/;
/** Asset paths in the manifest, the same pattern as `figure.src` in lesson.schema.json. */
const SAFE_ASSET_PATH = /^assets\/[a-z0-9-]+(\/[a-z0-9-]+)*\.svg$/;
/** A course id (kebab-case) and a content hash (16 hex characters). */
const SAFE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SAFE_HASH = /^[0-9a-f]{16}$/;

/**
 * Loads the built content: the manifest (once per session, always revalidated with the server)
 * and courses and lessons by id. Files are fetched with `?v=<hash>` from the manifest, so a new
 * image never shows an old lesson from the browser cache. The methods return promises, ready
 * for `resource()`.
 */
@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly http = inject(HttpClient);
  private manifest: Promise<ContentManifest> | null = null;

  /** The manifest; fetched once and shared. A failed fetch is tried again on the next call. */
  loadManifest(): Promise<ContentManifest> {
    this.manifest ??= this.fetchManifest().catch((error: unknown) => {
      this.manifest = null;
      throw error;
    });
    return this.manifest;
  }

  async loadCourse(courseId: string): Promise<Course> {
    const entry = await this.findCourse(courseId);
    const course = await this.fetchJson<Course>(entry.file, entry.hash);
    this.assertVersion(course, `course ${courseId}`);
    return course;
  }

  async loadLesson(courseId: string, lessonId: string): Promise<Lesson> {
    const course = await this.findCourse(courseId);
    const entry = course.lessons.find((lesson) => lesson.id === lessonId);
    if (!entry || entry.status !== 'published' || !entry.file || !entry.hash) {
      throw new ContentError('not-found', `No published lesson ${lessonId} in course ${courseId}.`);
    }
    const lesson = await this.fetchJson<Lesson>(entry.file, entry.hash);
    this.assertVersion(lesson, `lesson ${lessonId}`);
    return lesson;
  }

  /**
   * The url of each asset of a course, by its `figure.src`: `/content/<course>/<src>?v=<hash>`.
   * Comes from the shared manifest, so it costs no extra request. Paths outside `assets/` or
   * with an invalid hash are left out.
   */
  async assetUrls(courseId: string): Promise<ReadonlyMap<string, string>> {
    const course = await this.findCourse(courseId);
    const urls = new Map<string, string>();
    if (!SAFE_ID.test(course.id)) return urls;
    for (const { path, hash } of course.assets ?? []) {
      if (SAFE_ASSET_PATH.test(path) && SAFE_HASH.test(hash)) {
        urls.set(path, `${CONTENT_BASE}${course.id}/${path}?v=${hash}`);
      }
    }
    return urls;
  }

  private async fetchManifest(): Promise<ContentManifest> {
    const manifest = await this.fetchJson<ContentManifest>('manifest.json');
    this.assertVersion(manifest, 'the manifest');
    return manifest;
  }

  private async findCourse(courseId: string): Promise<ManifestCourse> {
    const manifest = await this.loadManifest();
    const course = manifest.courses.find((candidate) => candidate.id === courseId);
    if (!course) throw new ContentError('not-found', `No course ${courseId}.`);
    return course;
  }

  private assertVersion(data: unknown, what: string): void {
    const version =
      typeof data === 'object' && data !== null
        ? (data as { schemaVersion?: unknown }).schemaVersion
        : undefined;
    if (!isSupportedSchemaVersion(version)) {
      throw new ContentError(
        'unsupported-version',
        `Unsupported schemaVersion ${String(version)} in ${what}.`,
      );
    }
  }

  /** GET /content/<path> (with ?v=<hash>, or revalidated when there is no hash). */
  private async fetchJson<T>(path: string, hash?: string): Promise<T> {
    if (!SAFE_PATH.test(path)) {
      throw new ContentError('not-found', `Invalid content path ${path}.`);
    }
    const url = hash
      ? `${CONTENT_BASE}${path}?v=${encodeURIComponent(hash)}`
      : `${CONTENT_BASE}${path}`;
    try {
      return await firstValueFrom(this.http.get<T>(url, hash ? {} : { cache: 'no-cache' }));
    } catch (error) {
      throw toContentError(error, url);
    }
  }
}

function toContentError(error: unknown, url: string): ContentError {
  if (error instanceof HttpErrorResponse) {
    // A successful status with a body that is not JSON: the server's SPA fallback answered
    // with index.html, so the file does not exist.
    if (error.status === 404 || (error.status >= 200 && error.status < 300)) {
      return new ContentError('not-found', `${url} was not found.`, { cause: error });
    }
    return new ContentError('unavailable', `${url} is unavailable (${error.status}).`, {
      cause: error,
    });
  }
  return new ContentError('unavailable', `${url} could not be loaded.`, { cause: error });
}
