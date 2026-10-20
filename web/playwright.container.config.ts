import { defineConfig, devices } from '@playwright/test';

// The real image from deploy/compose.dev.yml on port 8090 (`npm run e2e:container`, needs Docker).
// Not part of `npm run verify`; the same server specs run there against the PocketBase binary.
const baseURL = 'http://127.0.0.1:8090';
const testMatch = ['server/**/*.spec.ts', 'container/**/*.spec.ts', 'smoke.spec.ts'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/container/global-setup.ts',
  globalTeardown: './e2e/container/global-teardown.ts',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'container-mobile', testMatch, use: { ...devices['Pixel 7'], baseURL } },
    { name: 'container-desktop', testMatch, use: { ...devices['Desktop Chrome'], baseURL } },
  ],
});
