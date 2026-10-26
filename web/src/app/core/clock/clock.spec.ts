import { TestBed } from '@angular/core/testing';
import { CLOCK } from './clock';

describe('CLOCK', () => {
  afterEach(() => vi.restoreAllMocks());

  it('the clock reads performance.now', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValueOnce(1234.5).mockReturnValueOnce(2000);
    const clock = TestBed.inject(CLOCK);
    expect(clock()).toBe(1234.5);
    expect(clock()).toBe(2000);
    expect(now).toHaveBeenCalledTimes(2);
  });
});
