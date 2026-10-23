// Links in content may not point to trackers or URL shorteners, nor carry tracking parameters.
// One list, so that changing it is one commit.

/** Hosts (and their subdomains) that are refused. */
export const trackerHosts = [
  'doubleclick.net',
  'google-analytics.com',
  'googletagmanager.com',
  'googleadservices.com',
  'googlesyndication.com',
  'bit.ly',
  't.co',
  'tinyurl.com',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'rebrand.ly',
  'lnkd.in',
];

/** Host plus path prefix that is refused (the host itself is fine). */
export const trackerPaths = [{ host: 'facebook.com', path: '/tr' }];

/** Query parameters that are refused; a trailing * matches any suffix. */
export const trackingParameters = [
  'utm_*',
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'mc_eid',
  'mc_cid',
  'igshid',
  '_hsenc',
  '_hsmi',
  'yclid',
];

function hostMatches(hostname, host) {
  return hostname === host || hostname.endsWith(`.${host}`);
}

/** Why this URL is a tracker, or null. */
export function trackerReason(url) {
  const hostname = url.hostname.toLowerCase();
  const host = trackerHosts.find((candidate) => hostMatches(hostname, candidate));
  if (host) return `${host} is een tracker of linkverkorter`;
  const path = trackerPaths.find(
    (candidate) =>
      hostMatches(hostname, candidate.host) &&
      (url.pathname === candidate.path || url.pathname.startsWith(`${candidate.path}/`)),
  );
  if (path) return `${path.host}${path.path} is een tracker`;
  for (const name of url.searchParams.keys()) {
    const lower = name.toLowerCase();
    const match = trackingParameters.find((parameter) =>
      parameter.endsWith('*') ? lower.startsWith(parameter.slice(0, -1)) : lower === parameter,
    );
    if (match) return `de parameter "${name}" is een trackingparameter`;
  }
  return null;
}
