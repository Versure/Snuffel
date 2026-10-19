import { expect, test as base } from '@playwright/test';

/**
 * Snuffel may never contact another host (privacy requirement).
 * Every test records requests to foreign origins and fails if there are any.
 */
export const test = base.extend<{ foreignRequests: string[] }>({
  foreignRequests: [
    async ({ page, baseURL }, use) => {
      const allowedOrigin = new URL(baseURL ?? 'http://localhost').origin;
      const foreign: string[] = [];
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.protocol.startsWith('http') && url.origin !== allowedOrigin) {
          foreign.push(request.url());
        }
      });
      await use(foreign);
      expect(foreign, 'requests to other hosts').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
