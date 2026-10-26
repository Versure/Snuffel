import { TestBed } from '@angular/core/testing';
import { INPUT_DEVICE } from './input-device';

/** A matchMedia that matches exactly the given queries. */
function stubMedia(matching: readonly string[]) {
  const matchMedia = vi.fn((query: string) => ({
    matches: matching.includes(query),
    media: query,
  }));
  vi.stubGlobal('matchMedia', matchMedia);
  return matchMedia;
}

const COARSE = '(pointer: coarse) and (hover: none)';
const FINE = '(any-pointer: fine)';

describe('INPUT_DEVICE', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('touchOnly is true for a coarse pointer without hover and without any fine pointer', () => {
    const matchMedia = stubMedia([COARSE]);
    expect(TestBed.inject(INPUT_DEVICE).touchOnly()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith(COARSE);
    expect(matchMedia).toHaveBeenCalledWith(FINE);
  });

  it('a fine pointer anywhere means no touch-only', () => {
    stubMedia([COARSE, FINE]);
    expect(TestBed.inject(INPUT_DEVICE).touchOnly()).toBe(false);
    stubMedia([FINE]);
    expect(TestBed.inject(INPUT_DEVICE).touchOnly()).toBe(false);
    stubMedia([]);
    expect(TestBed.inject(INPUT_DEVICE).touchOnly()).toBe(false);
  });

  it('is read again on every call', () => {
    stubMedia([COARSE]);
    const device = TestBed.inject(INPUT_DEVICE);
    expect(device.touchOnly()).toBe(true);
    stubMedia([COARSE, FINE]);
    expect(device.touchOnly()).toBe(false);
  });

  it('without matchMedia it is false', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(TestBed.inject(INPUT_DEVICE).touchOnly()).toBe(false);
  });
});
