import path from 'node:path';
import { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';

/**
 * Regression coverage for a 2026-09-01 bug: the header's flex row (brand + nav + account links +
 * avatar) had no slack budget on narrow phone viewports, which let the whole page be dragged
 * sideways on iOS Safari. Fixed with tighter mobile-only header spacing (layout/header/header.scss)
 * plus a global `overflow-x: hidden` safety net (styles/_reset.scss). This suite checks the
 * horizontal-overflow symptom directly rather than any specific pixel values, so it stays valid
 * regardless of future header content changes.
 */

const HLS_FIXTURE_DIR = path.join(__dirname, 'fixtures', 'hls');
const WATCH_SLUG = 'mobile-layout-test';
const WATCH_VIDEO_ID = '22222222-2222-2222-2222-222222222222';

// Same fixed test account as upload.spec.ts -- the local backend rate-limits /api/auth/register,
// so tests share one pre-seeded account instead of registering per run.
const TEST_USER = {
  identifier: 'testuser',
  password: 'Test1234!',
};

async function login(page: Page): Promise<void> {
  await page.goto('/auth');
  await page.getByLabel('Email or username').fill(TEST_USER.identifier);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/catalog/);
}

async function mockEmptyCatalogFeed(page: Page): Promise<void> {
  await page.route('**/api/videos?*', async (route) => {
    await route.fulfill({ json: { items: [], nextCursor: null } });
  });
}

function fixtureContentType(filename: string): string {
  return filename.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t';
}

async function mockWatchPage(page: Page): Promise<void> {
  await page.route(`**/api/videos/${WATCH_SLUG}`, async (route) => {
    await route.fulfill({
      json: {
        id: WATCH_VIDEO_ID,
        slug: WATCH_SLUG,
        title: 'Mobile layout test',
        description: '',
        durationSeconds: 3,
        width: 640,
        height: 360,
        visibility: 'PUBLIC',
        status: 'READY',
        publishedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    });
  });

  await page.route(`**/api/videos/${WATCH_VIDEO_ID}/manifest`, async (route) => {
    await route.fulfill({ json: { playlistUrl: '/e2e-fixtures/hls/stream.m3u8' } });
  });

  await page.route('**/e2e-fixtures/hls/**', async (route) => {
    const filename = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    await route.fulfill({
      path: path.join(HLS_FIXTURE_DIR, filename),
      contentType: fixtureContentType(filename),
    });
  });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflowsHorizontally = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflowsHorizontally).toBe(false);
}

test.describe('No horizontal page overflow on a narrow phone viewport', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true });

  test('catalog, signed out', async ({ page }) => {
    await mockEmptyCatalogFeed(page);
    await page.goto('/catalog');
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('catalog, signed in (the tightest header: nav + account links + sign out + avatar)', async ({
    page,
  }) => {
    await mockEmptyCatalogFeed(page);
    await login(page);
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Studio', exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('watch page, signed out', async ({ page }) => {
    await mockWatchPage(page);
    await page.goto(`/watch/${WATCH_SLUG}`);
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
