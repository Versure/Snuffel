import { ClientResponseError } from 'pocketbase';
import { isProgressError, ProgressError, toProgressError } from './progress-error';

describe('ProgressError', () => {
  it('is an Error with a reason, a name and an optional cause', () => {
    const cause = new Error('network');
    const error = new ProgressError('unavailable', 'Progress is unavailable.', { cause });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ProgressError');
    expect(error.reason).toBe('unavailable');
    expect(error.message).toBe('Progress is unavailable.');
    expect(error.cause).toBe(cause);
  });

  it('isProgressError tells progress errors apart from other errors', () => {
    expect(isProgressError(new ProgressError('refused', 'x'))).toBe(true);
    expect(isProgressError(new Error('x'))).toBe(false);
    expect(isProgressError('refused')).toBe(false);
  });

  it('toProgressError: no answer and 5xx are unavailable, 4xx refused', () => {
    const response = (status: number) => new ClientResponseError({ status });
    expect(toProgressError(response(0), 'x').reason).toBe('unavailable');
    expect(toProgressError(response(503), 'x').reason).toBe('unavailable');
    expect(toProgressError(response(400), 'x').reason).toBe('refused');
    expect(toProgressError(response(403), 'x').reason).toBe('refused');
    expect(toProgressError(response(404), 'x').reason).toBe('refused');
    expect(toProgressError(new TypeError('fetch failed'), 'x').reason).toBe('unavailable');
  });

  it('toProgressError keeps a ProgressError and the cause of anything else', () => {
    const original = new ProgressError('refused', 'x');
    expect(toProgressError(original, 'y')).toBe(original);
    const cause = new ClientResponseError({ status: 403 });
    const error = toProgressError(cause, 'Saving a tick');
    expect(error.cause).toBe(cause);
    expect(error.message).toBe('Saving a tick failed (403).');
  });
});
