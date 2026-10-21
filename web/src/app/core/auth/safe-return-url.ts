/**
 * The page to go to after logging in (`/login?terug=…`). Only paths inside the app are
 * allowed: they start with a single `/`. Everything else (`//host`, `/\host`, an absolute URL with a scheme,
 * control characters, nothing at all) gives `/`, so the login page is no open redirect.
 */
export function safeReturnUrl(value: string | null | undefined): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/';
  if (value.startsWith('//') || value.startsWith('/\\')) return '/';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\s]/.test(value)) return '/';
  return value;
}
