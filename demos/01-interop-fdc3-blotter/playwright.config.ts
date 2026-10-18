import { defineConfig } from '@playwright/test';

/**
 * Browser-mode end-to-end tests. They run the demo pages in plain Chromium
 * (no OpenFin runtime) using the BroadcastChannel-based FDC3 shim.
 *
 * - `npx playwright install chromium` once, then `npm run test:e2e`.
 * - Set DEEPHAVEN_URL (e.g. http://localhost:10000) to also run the live
 *   Deephaven bridge test.
 * - Set PLAYWRIGHT_CHROMIUM_PATH to use an already-installed Chromium binary
 *   instead of the one Playwright downloads.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
