import { ClientResponseError } from 'pocketbase';

/**
 * Why progress could not be loaded or saved:
 * - `unavailable`: the server could not be reached or answered with a server error (5xx);
 * - `refused`: the server refused the request (4xx: a rule, validation or a lost session).
 */
export type ProgressErrorReason = 'unavailable' | 'refused';

export class ProgressError extends Error {
  override readonly name = 'ProgressError';

  constructor(
    readonly reason: ProgressErrorReason,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

export function isProgressError(error: unknown): error is ProgressError {
  return error instanceof ProgressError;
}

/** Turns anything thrown by the PocketBase client into a ProgressError. */
export function toProgressError(error: unknown, what: string): ProgressError {
  if (isProgressError(error)) return error;
  const status = error instanceof ClientResponseError ? error.status : 0;
  const reason: ProgressErrorReason = status >= 400 && status < 500 ? 'refused' : 'unavailable';
  return new ProgressError(reason, `${what} failed (${status || 'no answer'}).`, { cause: error });
}
