import { defineConfig } from '@playwright/test';

/**
 * Browser-mode end-to-end tests for demo 02. The Desk Controller's
 * window/monitor features need the `fin` API, which the tests provide with a
 * small mock (tests/e2e/fin-mock.ts) injected before the page loads.
 *
 * - `npx playwright install chromium` once, then `npm run test:e2e`.
 * - PLAYWRIGHT_CHROMIUM_PATH: use an already-installed Chromium binary.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5174',
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5174/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
