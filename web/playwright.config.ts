import { defineConfig, devices } from '@playwright/test';

const port = 4300;
// The production build served by the pinned PocketBase binary (tools/serve-pocketbase.mjs).
const serverPort = 8091;
const serverURL = `http://127.0.0.1:${serverPort}`;
// Optional: a preinstalled Chromium, for environments that cannot download Playwright's own build.
const executablePath = process.env['PLAYWRIGHT_CHROMIUM_PATH'] || undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    launchOptions: { executablePath },
  },
  projects: [
    {
      name: 'mobile',
      testIgnore: ['server/**', 'container/**'],
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'desktop',
      testIgnore: ['server/**', 'container/**'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Test accounts (pocketbase/seed/dev-accounts.json) for the server projects.
      name: 'server-setup',
      testMatch: 'server/seed.setup.ts',
      use: { baseURL: serverURL },
    },
    {
      name: 'server-mobile',
      testMatch: 'server/**/*.spec.ts',
      testIgnore: 'server/seed.setup.ts',
      dependencies: ['server-setup'],
      use: { ...devices['Pixel 7'], baseURL: serverURL },
    },
    {
      name: 'server-desktop',
      testMatch: 'server/**/*.spec.ts',
      testIgnore: 'server/seed.setup.ts',
      dependencies: ['server-setup'],
      use: { ...devices['Desktop Chrome'], baseURL: serverURL },
    },
  ],
  webServer: [
    {
      command: `npx ng serve --port ${port}`,
      url: `http://localhost:${port}`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: `npm run build && node ../tools/serve-pocketbase.mjs --port ${serverPort} --data ../pocketbase/pb_data/e2e --dev-superuser`,
      url: `${serverURL}/api/health`,
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
