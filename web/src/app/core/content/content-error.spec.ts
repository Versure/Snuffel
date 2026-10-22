import { ContentError, isContentError } from './content-error';

describe('ContentError', () => {
  it('is an Error with a reason, a name and an optional cause', () => {
    const cause = new Error('network');
    const error = new ContentError('unavailable', 'Content is unavailable.', { cause });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ContentError');
    expect(error.reason).toBe('unavailable');
    expect(error.message).toBe('Content is unavailable.');
    expect(error.cause).toBe(cause);
  });

  it('isContentError tells content errors apart from other errors', () => {
    expect(isContentError(new ContentError('not-found', 'x'))).toBe(true);
    expect(isContentError(new Error('x'))).toBe(false);
    expect(isContentError('not-found')).toBe(false);
  });
});
