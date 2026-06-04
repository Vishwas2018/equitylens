import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000';
const USE_WEBSERVER = !process.env['PLAYWRIGHT_BASE_URL'];

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // auth tests share state via Supabase; run sequentially
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: USE_WEBSERVER
    ? {
        command: 'cd apps/web && pnpm dev',
        url: BASE_URL,
        reuseExistingServer: !process.env['CI'],
        timeout: 120_000,
      }
    : undefined,
});
