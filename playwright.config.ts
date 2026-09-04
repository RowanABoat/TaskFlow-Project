import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the TaskFlow end-to-end and API suites.
 *
 * `webServer` boots the dependency-free Node server in `server/`, which serves
 * both the static site and the ticket REST API on one port. UI specs navigate
 * against `baseURL`; API specs hit the same origin through the `request`
 * fixture and never open a browser.
 *
 * By default only the Chromium-backed UI projects run, which is what most local
 * checkouts have installed. Set `PW_ALL_BROWSERS=1` (as CI does) to add the
 * Firefox and WebKit projects. The `api` project always runs.
 */

const PORT = Number(process.env.PORT ?? 4173);
const BASE_URL = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`;
const allBrowsers = process.env.PW_ALL_BROWSERS === '1';

export default defineConfig({
  testDir: './e2e/specs',
  outputDir: './test-results',
  snapshotDir: './e2e/snapshots',

  // Every spec isolates its own board state, so files and tests can interleave.
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,

  timeout: 30_000,
  expect: { timeout: 5_000 },

  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['list']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      // API specs share one in-memory board on the server, so they run in
      // sequence and reset it between tests. See e2e/api/tickets.spec.ts.
      name: 'api',
      testDir: './e2e/api',
      fullyParallel: false,
    },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    ...(allBrowsers
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        ]
      : []),
  ],

  webServer: {
    command: `node server/static-server.js --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
