import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against the real dev server (proxy.conf.json forwards /api to the local Spring
 * Boot backend on localhost:8080 — see CLAUDE.md section 8). The backend must be running
 * separately before `npm run e2e`; only the presigned storage PUTs are mocked in the tests themselves.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  // The upload flow needs several status polls (5s interval) plus several `toPass` retries
  // while typing into forms — Playwright's default of 30s is too tight for that.
  timeout: 60_000,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
