import { expect, test as base } from '@playwright/test';

/** The clean-up steps of the running test (a worker runs one test at a time). */
const cleanups: (() => Promise<void>)[] = [];

/** Runs `cleanup` when the running test ends, passed or failed (newest first). */
export function afterThisTest(cleanup: () => Promise<void>): void {
  cleanups.push(cleanup);
}

/**
 * Snuffel may never contact another host (privacy requirement).
 * Every test records requests to foreign origins and fails if there are any.
 */
export const test = base.extend<{ foreignRequests: string[]; cleanup: void }>({
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
  // Steps registered with `afterThisTest`, such as deleting the test's own child accounts.
  cleanup: [
    // eslint-disable-next-line no-empty-pattern -- Playwright needs the object pattern
    async ({}, use) => {
      cleanups.length = 0;
      await use();
      for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
    },
    { auto: true },
  ],
});

export { expect };
