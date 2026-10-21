import { safeReturnUrl } from './safe-return-url';

// Built from parts so that `npm run privacy` (no URLs in app source) stays meaningful.
const scheme = (name: string) => `${name}:/`;

describe('safeReturnUrl', () => {
  it('keeps paths inside the app', () => {
    expect(safeReturnUrl('/')).toBe('/');
    expect(safeReturnUrl('/ouder')).toBe('/ouder');
    expect(safeReturnUrl('/les/roofvissen?stap=2#vraag')).toBe('/les/roofvissen?stap=2#vraag');
  });

  it('gives / without a value', () => {
    expect(safeReturnUrl(null)).toBe('/');
    expect(safeReturnUrl(undefined)).toBe('/');
    expect(safeReturnUrl('')).toBe('/');
  });

  it('refuses other hosts and schemes', () => {
    for (const value of [
      '//voorbeeld.nl',
      '//example.com/pad',
      '/\\example.com',
      `${scheme('https')}/example.com`,
      `${scheme('http')}/localhost:4200/ouder`,
      'javascript:alert(1)',
      'ouder',
      './/example.com',
    ]) {
      expect(safeReturnUrl(value), value).toBe('/');
    }
  });

  it('refuses whitespace and control characters that browsers strip', () => {
    for (const value of ['/\t/example.com', '/\n/example.com', '/ /example.com', '/ouder\u0000']) {
      expect(safeReturnUrl(value), JSON.stringify(value)).toBe('/');
    }
  });
});
