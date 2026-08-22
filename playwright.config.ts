import { defineConfig, devices } from '@playwright/test';

/**
 * E2E gegen den echten Dev-Server (proxy.conf.json leitet /api an das lokale Spring-Boot-Backend
 * auf localhost:8080 weiter — siehe CLAUDE.md Abschnitt 8). Das Backend muss vor `npm run e2e`
 * separat laufen; nur die presigned-Storage-PUTs werden in den Tests selbst gemockt.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
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
