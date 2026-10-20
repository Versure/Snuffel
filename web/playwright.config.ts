import { defineConfig, devices } from '@playwright/test';

const port = 4300;
// The production build served by the pinned PocketBase binary (tools/serve-pocketbase.mjs).
const serverPort = 8091;
const serverURL = `http://127.0.0.1:${serverPort}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
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
      name: 'server-mobile',
      testMatch: 'server/**/*.spec.ts',
      use: { ...devices['Pixel 7'], baseURL: serverURL },
    },
    {
      name: 'server-desktop',
      testMatch: 'server/**/*.spec.ts',
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
      command: `npm run build && node ../tools/serve-pocketbase.mjs --port ${serverPort} --data ../pocketbase/pb_data/e2e`,
      url: `${serverURL}/api/health`,
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
