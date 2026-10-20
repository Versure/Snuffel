/// <reference path="../pb_data/types.d.ts" />

// Security headers for the app routes (everything except /api/ and the admin UI /_/).
// The Content-Security-Policy makes the browser itself refuse anything from another host.
// Note: PocketBase runs every handler in its own context, so all values live inside it.
routerUse((e) => {
  const path = e.request.url.path;
  const excluded = ['/api', '/_'].some(
    (prefix) => path === prefix || path.startsWith(prefix + '/'),
  );
  if (!excluded) {
    const header = e.response.header();
    header.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
      ].join('; '),
    );
    header.set('Referrer-Policy', 'no-referrer');
    header.set('X-Content-Type-Options', 'nosniff');
  }
  return e.next();
});
