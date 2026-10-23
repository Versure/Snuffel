/**
 * Why content could not be loaded:
 * - `not-found`: unknown course or lesson, a lesson that is only planned, or a missing file;
 * - `unsupported-version`: a schemaVersion this app does not know (a newer image is needed);
 * - `unavailable`: the server could not be reached or answered with an error.
 */
export type ContentErrorReason = 'not-found' | 'unsupported-version' | 'unavailable';

export class ContentError extends Error {
  override readonly name = 'ContentError';

  constructor(
    readonly reason: ContentErrorReason,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

export function isContentError(error: unknown): error is ContentError {
  return error instanceof ContentError;
}
