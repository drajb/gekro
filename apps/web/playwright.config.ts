import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the /apps browser smoke suite.
 *
 * Local:  `pnpm --filter web exec playwright test` builds nothing — it starts
 *         `astro preview` on :4457 (serving the last `pnpm build` output) and
 *         tests against it. Point at an already-running server instead with
 *         `PW_BASE_URL=http://localhost:4456`.
 * CI:     the e2e workflow runs `pnpm build` first, then this starts preview.
 */
const baseURL = process.env.PW_BASE_URL || 'http://localhost:4457';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL,
    headless: true,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // When PW_BASE_URL is set we trust an external server and skip managing one.
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: 'pnpm preview --port 4457',
        url: 'http://localhost:4457',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
