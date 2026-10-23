import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ContentError, type ContentErrorReason } from './content-error';
import { ContentService } from './content.service';
import type { ContentManifest, Course, Lesson } from './content.types';
import { isSupportedSchemaVersion, SUPPORTED_SCHEMA_VERSIONS } from './supported-versions';

const manifest: ContentManifest = {
  schemaVersion: 1,
  courses: [
    {
      id: 'proefcursus',
      title: 'Proefcursus',
      kind: 'course',
      file: 'proefcursus/course.json',
      hash: '0123456789abcdef',
      lessons: [
        {
          id: 'proefles',
          title: 'Proefles',
          status: 'published',
          version: 1,
          estimatedMinutes: 11,
          file: 'proefcursus/lessons/proefles.json',
          hash: 'fedcba9876543210',
        },
        { id: 'proefles-later', title: 'Later', status: 'planned' },
      ],
      assets: [
        { path: 'assets/hengeltop.svg', hash: 'aaaaaaaaaaaaaaaa' },
        { path: 'assets/vissen/snoek.svg', hash: 'bbbbbbbbbbbbbbbb' },
      ],
    },
    {
      id: 'tweede',
      title: 'Tweede',
      kind: 'course',
      file: 'tweede/course.json',
      hash: '1111111111111111',
      lessons: [
        {
          id: 'andere-les',
          title: 'Andere les',
          status: 'published',
          version: 3,
          estimatedMinutes: 9,
          file: 'tweede/lessons/andere-les.json',
          hash: '2222222222222222',
        },
      ],
      assets: [],
    },
  ],
};

const course = { schemaVersion: 1, id: 'proefcursus', title: 'Proefcursus' } as Course;
const lesson = { schemaVersion: 1, id: 'proefles', version: 1 } as Lesson;

const manifestUrl = '/content/manifest.json';
const courseUrl = '/content/proefcursus/course.json?v=0123456789abcdef';
const lessonUrl = '/content/proefcursus/lessons/proefles.json?v=fedcba9876543210';

describe('ContentService', () => {
  let service: ContentService;
  let http: HttpTestingController;
  const seen: string[] = [];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withFetch()), provideHttpClientTesting()],
    });
    service = TestBed.inject(ContentService);
    http = TestBed.inject(HttpTestingController);
    seen.length = 0;
  });

  afterEach(() => {
    http.verify();
    // Privacy rule: content only comes from the app's own server.
    for (const url of seen) {
      expect(url.startsWith('/content/')).toBe(true);
      expect(url).not.toMatch(/^[a-z]+:|^\/\//i);
    }
  });

  /** Waits (a few macrotasks) for the request to `url` and returns it. */
  async function request(url: string): Promise<TestRequest> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const [match] = http.match((candidate) => candidate.urlWithParams === url);
      if (match) {
        seen.push(match.request.urlWithParams);
        return match;
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error(`no request to ${url}`);
  }

  async function expectReason(promise: Promise<unknown>, reason: ContentErrorReason) {
    const error: unknown = await promise.then(
      () => null,
      (rejection: unknown) => rejection,
    );
    expect(error).toBeInstanceOf(ContentError);
    expect((error as ContentError).reason).toBe(reason);
  }

  it('fetches the manifest once (two calls, one request) and revalidates it', async () => {
    const first = service.loadManifest();
    const second = service.loadManifest();
    const req = await request(manifestUrl);
    expect(req.request.method).toBe('GET');
    expect(req.request.cache).toBe('no-cache');
    req.flush(manifest);
    expect(await first).toEqual(manifest);
    expect(await second).toEqual(manifest);
    expect(await service.loadManifest()).toEqual(manifest);
  });

  it('loads a course by id with the hash from the manifest', async () => {
    const result = service.loadCourse('proefcursus');
    (await request(manifestUrl)).flush(manifest);
    const req = await request(courseUrl);
    expect(req.request.cache).not.toBe('no-cache');
    req.flush(course);
    expect(await result).toEqual(course);
  });

  it('loads a lesson from /content/<course>/lessons/<lesson>.json?v=<hash>', async () => {
    const result = service.loadLesson('proefcursus', 'proefles');
    (await request(manifestUrl)).flush(manifest);
    (await request(lessonUrl)).flush(lesson);
    expect(await result).toEqual(lesson);
  });

  it('gives not-found without a request for unknown, planned or misplaced lessons', async () => {
    const loaded = service.loadManifest();
    (await request(manifestUrl)).flush(manifest);
    await loaded;
    await expectReason(service.loadCourse('bestaat-niet'), 'not-found');
    await expectReason(service.loadLesson('bestaat-niet', 'proefles'), 'not-found');
    await expectReason(service.loadLesson('proefcursus', 'bestaat-niet'), 'not-found');
    await expectReason(service.loadLesson('proefcursus', 'proefles-later'), 'not-found');
    await expectReason(service.loadLesson('proefcursus', 'andere-les'), 'not-found');
    // http.verify() in afterEach: no request besides the manifest.
  });

  it('gives unsupported-version for schemaVersion 2 in the manifest', async () => {
    const result = service.loadManifest();
    (await request(manifestUrl)).flush({ ...manifest, schemaVersion: 2 });
    await expectReason(result, 'unsupported-version');
  });

  it('gives unsupported-version for schemaVersion 2 in a course or lesson', async () => {
    const courseResult = service.loadCourse('proefcursus');
    (await request(manifestUrl)).flush(manifest);
    (await request(courseUrl)).flush({ ...course, schemaVersion: 2 });
    await expectReason(courseResult, 'unsupported-version');

    const lessonResult = service.loadLesson('proefcursus', 'proefles');
    (await request(lessonUrl)).flush({ ...lesson, schemaVersion: 2 });
    await expectReason(lessonResult, 'unsupported-version');
  });

  it('maps 404 to not-found, and status 0 and 503 to unavailable', async () => {
    const loaded = service.loadManifest();
    (await request(manifestUrl)).flush(manifest);
    await loaded;

    const missing = service.loadLesson('proefcursus', 'proefles');
    (await request(lessonUrl)).flush('Not found', { status: 404, statusText: 'Not Found' });
    await expectReason(missing, 'not-found');

    const offline = service.loadLesson('proefcursus', 'proefles');
    (await request(lessonUrl)).error(new ProgressEvent('error'), { status: 0 });
    await expectReason(offline, 'unavailable');

    const down = service.loadCourse('proefcursus');
    (await request(courseUrl)).flush('Unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
    });
    await expectReason(down, 'unavailable');
  });

  it('maps an HTML answer (the SPA fallback for a missing file) to not-found', async () => {
    const result = service.loadLesson('proefcursus', 'proefles');
    (await request(manifestUrl)).flush(manifest);
    const req = await request(lessonUrl);
    req.error(new ProgressEvent('error'), { status: 200, statusText: 'OK' });
    await expectReason(result, 'not-found');
  });

  it('tries a failed manifest again on the next call', async () => {
    const failed = service.loadManifest();
    (await request(manifestUrl)).flush('down', { status: 503, statusText: 'Service Unavailable' });
    await expectReason(failed, 'unavailable');

    const retried = service.loadManifest();
    (await request(manifestUrl)).flush(manifest);
    expect(await retried).toEqual(manifest);
  });

  it('refuses manifest paths that leave /content/', async () => {
    const result = service.loadCourse('proefcursus');
    (await request(manifestUrl)).flush({
      ...manifest,
      courses: [{ ...manifest.courses[0], file: '../evil.json' }],
    });
    await expectReason(result, 'not-found');
  });
});

describe('ContentService.assetUrls', () => {
  let service: ContentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withFetch()), provideHttpClientTesting()],
    });
    service = TestBed.inject(ContentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function flushManifest(data: unknown = manifest): Promise<void> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const [match] = http.match(manifestUrl);
      if (match) {
        match.flush(data as ContentManifest);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error('no manifest request');
  }

  it('assetUrls maps each asset to its url with the hash', async () => {
    const result = service.assetUrls('proefcursus');
    await flushManifest();
    expect([...(await result)]).toEqual([
      ['assets/hengeltop.svg', '/content/proefcursus/assets/hengeltop.svg?v=aaaaaaaaaaaaaaaa'],
      [
        'assets/vissen/snoek.svg',
        '/content/proefcursus/assets/vissen/snoek.svg?v=bbbbbbbbbbbbbbbb',
      ],
    ]);
    expect((await service.assetUrls('tweede')).size).toBe(0);
  });

  it('assetUrls of an unknown course gives not-found', async () => {
    const result = service.assetUrls('bestaat-niet');
    await flushManifest();
    const error: unknown = await result.then(
      () => null,
      (rejection: unknown) => rejection,
    );
    expect(error).toBeInstanceOf(ContentError);
    expect((error as ContentError).reason).toBe('not-found');
  });

  it('assetUrls skips a path outside assets/', async () => {
    const result = service.assetUrls('proefcursus');
    await flushManifest({
      ...manifest,
      courses: [
        {
          ...manifest.courses[0],
          assets: [
            { path: '../geheim.svg', hash: 'aaaaaaaaaaaaaaaa' },
            { path: 'assets/../../x.svg', hash: 'aaaaaaaaaaaaaaaa' },
            { path: 'lessons/proefles.json', hash: 'aaaaaaaaaaaaaaaa' },
            { path: 'assets/goed.svg', hash: 'niet-hex' },
            { path: 'assets/goed.svg', hash: 'cccccccccccccccc' },
          ],
        },
      ],
    });
    expect([...(await result).keys()]).toEqual(['assets/goed.svg']);
  });

  it('assetUrls does not fetch the manifest twice', async () => {
    const first = service.assetUrls('proefcursus');
    const second = service.assetUrls('proefcursus');
    await flushManifest();
    expect((await first).size).toBe(2);
    expect((await second).size).toBe(2);
    expect((await service.assetUrls('proefcursus')).size).toBe(2);
    // http.verify() in afterEach: no further request.
  });
});

describe('SUPPORTED_SCHEMA_VERSIONS', () => {
  it('supports version 1 only', () => {
    expect(SUPPORTED_SCHEMA_VERSIONS).toEqual([1]);
    expect(isSupportedSchemaVersion(1)).toBe(true);
    expect(isSupportedSchemaVersion(2)).toBe(false);
    expect(isSupportedSchemaVersion('1')).toBe(false);
    expect(isSupportedSchemaVersion(undefined)).toBe(false);
  });
});
