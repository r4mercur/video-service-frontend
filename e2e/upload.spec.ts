import { Locator, Page } from '@playwright/test';
import { expect, test } from './support/fixtures';

/**
 * Auth (register/login) runs against the real local backend, as verified in AP 3.
 * Everything around the video upload itself (initiate/complete/status + the presigned storage
 * PUTs) is mocked here: a real object store with matching CORS configuration (Access-Control-
 * Expose-Headers: ETag) can't be assumed in a local dev environment, and the backend's
 * `complete` call would fail against real MinIO/Garage anyway if the bytes (as here) never
 * actually arrive. The UI behavior (states, progress, step tracker) is still covered
 * end-to-end regardless.
 */

const VIDEO_ID = 'e2e-fake-video-id';
const VIDEO_SLUG = 'e2e-test-clip';
const PART_URL = 'https://mock-storage.e2e.local/part-1';

// Fixed test account instead of registering per run — the local backend rate-limits
// /api/auth/register per time window, which made repeated local test runs unreliable.
// The account must already exist (see backend test data/seed).
const TEST_USER = {
  identifier: 'testuser',
  password: 'Test1234!',
};

// Both `.fill()` and `.pressSequentially()` occasionally leave a field empty when Chromium
// shows an autofill suggestion dropdown (due to `type="email"`/`autocomplete`) that collides
// with the input. `toPass` makes this robust instead of chasing the root cause through
// third-party auth code.
async function typeReliably(locator: Locator, value: string): Promise<void> {
  await expect(async () => {
    await locator.fill('');
    await locator.pressSequentially(value);
    expect(await locator.inputValue()).toBe(value);
  }).toPass({ timeout: 5000 });
}

async function login(page: Page): Promise<void> {
  await page.goto('/auth');
  await typeReliably(page.getByLabel('Email or username'), TEST_USER.identifier);
  await typeReliably(page.getByLabel('Password'), TEST_USER.password);
  // "Log in" is both the tab button and the submit button — [type=submit] disambiguates.
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/catalog/);
}

async function mockUploadBackend(page: Page): Promise<void> {
  await page.route('**/api/categories', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 1, slug: 'drama', name: 'Drama', sortOrder: 1 }]),
    });
  });

  await page.route('**/api/videos', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const body = route.request().postDataJSON() as { sizeBytes: number };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        videoId: VIDEO_ID,
        parts: [{ partNumber: 1, url: PART_URL }],
        partSizeBytes: body.sizeBytes,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      }),
    });
  });

  await page.route(PART_URL, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'PUT, OPTIONS',
          'access-control-allow-headers': 'content-type',
        },
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-expose-headers': 'ETag',
        etag: '"e2e-mock-etag"',
      },
      body: '',
    });
  });

  await page.route(`**/api/videos/${VIDEO_ID}/complete`, async (route) => {
    await route.fulfill({ status: 200, body: '' });
  });

  let statusPolls = 0;
  await page.route(`**/api/videos/${VIDEO_ID}/status`, async (route) => {
    statusPolls++;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: statusPolls < 2 ? 'PROCESSING' : 'READY' }),
    });
  });

  await page.route('**/api/me/videos', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [{ id: VIDEO_ID, slug: VIDEO_SLUG }] }),
    });
  });
}

/** Custom thumbnail endpoint mocked separately, since not every test should hit it. */
async function mockThumbnailRoute(page: Page, status: 200 | 400): Promise<() => number> {
  let calls = 0;
  await page.route(`**/api/videos/${VIDEO_ID}/thumbnail`, async (route) => {
    calls++;
    if (status === 200) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: VIDEO_ID, hasCustomThumbnail: true }),
      });
      return;
    }
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ title: 'Invalid image', detail: 'Not a supported image.' }),
    });
  });
  return () => calls;
}

test.describe('Upload', () => {
  test('drop zone → metadata → transfer → published', async ({ page }) => {
    await mockUploadBackend(page);
    await login(page);

    await page.getByRole('link', { name: 'Upload', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Add a video' })).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({
      name: 'clip.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.alloc(2_000_000, 1),
    });

    await expect(page.getByRole('heading', { name: 'Add a few details' })).toBeVisible();
    await typeReliably(page.getByLabel('Title'), 'E2E Test Clip');
    await page.getByRole('button', { name: 'Select a genre' }).click();
    await page.getByRole('option', { name: 'Drama' }).click();
    await page.getByRole('button', { name: 'Start upload' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Uploading 1 video' })).toBeVisible({
      timeout: 15_000,
    });
    // Mocked parts resolve near-instantly, so the transferring 100% can flash by in a single
    // frame — the reliable checkpoint is the h1 switching to the processing-stage heading.
    await expect(page.getByRole('heading', { level: 1, name: 'clip.mp4' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('heading', { name: 'Your video is live' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('link', { name: 'Watch your video' })).toHaveAttribute(
      'href',
      `/watch/${VIDEO_SLUG}`,
    );
  });

  test('rejects a file with the wrong type', async ({ page }) => {
    await mockUploadBackend(page);
    await login(page);

    await page.getByRole('link', { name: 'Upload', exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a video'),
    });

    await expect(page.getByText('Please choose an MP4, MOV or WebM file.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add a video' })).toBeVisible();
  });

  async function selectVideoAndReachMetadataStep(page: Page): Promise<void> {
    await page.getByRole('link', { name: 'Upload', exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'clip.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.alloc(2_000_000, 1),
    });
    await expect(page.getByRole('heading', { name: 'Add a few details' })).toBeVisible();
    await typeReliably(page.getByLabel('Title'), 'E2E Test Clip');
    await page.getByRole('button', { name: 'Select a genre' }).click();
    await page.getByRole('option', { name: 'Drama' }).click();
  }

  test('uploads a custom thumbnail alongside the video', async ({ page }) => {
    await mockUploadBackend(page);
    const thumbnailCalls = await mockThumbnailRoute(page, 200);
    await login(page);

    await selectVideoAndReachMetadataStep(page);
    // The drop-zone input is unmounted at the "metadata" stage, so this is unambiguously the thumbnail input.
    await page.locator('input[type="file"]').setInputFiles({
      name: 'cover.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.alloc(50_000, 2),
    });
    await expect(page.getByRole('button', { name: 'Change image' })).toBeVisible();

    await page.getByRole('button', { name: 'Start upload' }).click();

    await expect(page.getByRole('heading', { name: 'Your video is live' })).toBeVisible({
      timeout: 20_000,
    });
    expect(thumbnailCalls()).toBe(1);
  });

  test('continues the upload even if the custom thumbnail save fails', async ({ page }) => {
    await mockUploadBackend(page);
    await mockThumbnailRoute(page, 400);
    await login(page);

    await selectVideoAndReachMetadataStep(page);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'cover.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.alloc(50_000, 2),
    });
    await page.getByRole('button', { name: 'Start upload' }).click();

    await expect(page.getByText(/Custom thumbnail couldn't be saved/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('heading', { name: 'Your video is live' })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('rejects an oversized custom thumbnail image', async ({ page }) => {
    await mockUploadBackend(page);
    await login(page);

    await selectVideoAndReachMetadataStep(page);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'huge.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.alloc(8_000_001, 2),
    });

    await expect(page.getByText('This image is larger than 8 MB.')).toBeVisible();
    // Start upload remains possible — the thumbnail is optional, only the invalid attempt was discarded.
    await expect(page.getByRole('button', { name: 'Choose image' })).toBeVisible();
  });
});
