import { Locator, Page, expect, test } from '@playwright/test';

/**
 * Auth (register/login) läuft gegen das echte lokale Backend, wie in AP 3 verifiziert.
 * Alles rund um den Video-Upload selbst (initiate/complete/status + die presigned Storage-PUTs)
 * wird hier gemockt: ein echter Object-Store mit passender CORS-Konfiguration (Access-Control-
 * Expose-Headers: ETag) kann in einer lokalen Dev-Umgebung nicht vorausgesetzt werden, und der
 * Backend-`complete`-Call würde gegen echtes MinIO/Garage ohnehin fehlschlagen, wenn die Bytes
 * (wie hier) nie wirklich ankommen. Das UI-Verhalten (Zustände, Fortschritt, Step-Tracker) ist
 * damit trotzdem end-to-end abgedeckt.
 */

const VIDEO_ID = 'e2e-fake-video-id';
const PART_URL = 'https://mock-storage.e2e.local/part-1';

function uniqueUser() {
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return {
    email: `e2e-${suffix}@example.com`,
    username: `e2e${suffix}`,
    password: 'correct-horse-battery-staple',
  };
}

// Sowohl `.fill()` als auch `.pressSequentially()` lassen das Feld gelegentlich leer, wenn
// Chromium wegen `type="email"`/`autocomplete` eine Autofill-Vorschlagsleiste einblendet, die
// mit der Eingabe kollidiert (~40% der Läufe im lokalen Test, ausschließlich beim Email-Feld).
// `toPass` macht das robust, statt die Ursache in fremdem Auth-Code zu jagen.
async function typeReliably(locator: Locator, value: string): Promise<void> {
  await expect(async () => {
    await locator.fill('');
    await locator.pressSequentially(value);
    expect(await locator.inputValue()).toBe(value);
  }).toPass({ timeout: 5000 });
}

async function signUp(page: Page, user: ReturnType<typeof uniqueUser>): Promise<void> {
  await page.goto('/auth');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await typeReliably(page.getByLabel('Email'), user.email);
  await typeReliably(page.getByLabel('Username'), user.username);
  await typeReliably(page.getByLabel('Password'), user.password);
  await page.getByRole('button', { name: 'Create account' }).click();
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
}

// Ein Test-User für die ganze Suite statt einer Registrierung pro Test — das lokale Backend
// begrenzt Registrierungen pro Zeitfenster, und beide Szenarien teilen sich ohnehin denselben
// Mock-Setup.
test.describe.serial('Upload', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await mockUploadBackend(page);
    await signUp(page, uniqueUser());
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('drop zone → metadata → transfer → published', async () => {
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

    await expect(page.getByRole('heading', { name: 'Uploading 1 video' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('100%')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Your video is live' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('rejects a file with the wrong type', async () => {
    await page.getByRole('link', { name: 'Upload', exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a video'),
    });

    await expect(page.getByText('Please choose an MP4, MOV or WebM file.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add a video' })).toBeVisible();
  });
});
