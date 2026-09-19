import { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';

/**
 * Profile photo happy path against the real local backend (backend CLAUDE.md §9.8): upload via
 * the header dialog, the stored image actually loads from object storage, removal falls back to
 * the initials. Nothing is mocked - this is the one place the multipart request, the ffmpeg
 * normalization and the storage URL are exercised together from a browser.
 */

// Same fixed test account as upload.spec.ts -- the local backend rate-limits /api/auth/register,
// so tests share one pre-seeded account instead of registering per run.
const TEST_USER = {
  identifier: 'testuser',
  password: 'Test1234!',
};

// 64x40 solid-colour PNG, generated with ffmpeg. Deliberately not square: the backend
// center-crops and scales to 256x256, which the naturalWidth assertion below relies on.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAAAoCAIAAADBrGu+AAAACXBIWXMAAAABAAAAAQBPJcTWAAAAXElEQVR4nNXOQQ0AIBDAsJFMJVIQTxBxD7Iq6Dr7UiZxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEufvwNQDUOgCcEjbXV4AAAAASUVORK5CYII=',
  'base64',
);

async function login(page: Page): Promise<void> {
  await page.goto('/auth');
  await page.getByLabel('Email or username').fill(TEST_USER.identifier);
  await page.getByLabel('Password').fill(TEST_USER.password);
  // Scoped to app-button: "Log in" is also the tab button, and the header search box has its own
  // submit button since 2026-09-13 - a bare button[type=submit] matches two elements.
  await page.locator('app-button').getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/catalog/);
}

async function openDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Change profile photo' }).click();
  await expect(page.getByRole('heading', { name: 'Profile photo' })).toBeVisible();
}

test.describe('profile photo', () => {
  // Both browser projects would otherwise change the same shared account at the same time and
  // race each other's assertions. Nothing here is engine-specific (CLAUDE.md §8's WebKit
  // requirement is about the player), so one engine is enough.
  test.skip(({ browserName }) => browserName !== 'chromium', 'Mutates the shared test account');

  test('upload shows the photo in the header, removal restores the initials', async ({ page }) => {
    await login(page);
    const avatarButton = page.getByRole('button', { name: 'Change profile photo' });

    await openDialog(page);
    await page
      .locator('.profile-photo-dialog__input')
      .setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('heading', { name: 'Profile photo' })).toBeHidden();
    const headerImage = avatarButton.locator('img');
    await expect(headerImage).toBeVisible();
    // Loaded for real from the storage origin, not just rendered with a src.
    await expect
      .poll(() => headerImage.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBe(256);

    await openDialog(page);
    await page.getByRole('button', { name: 'Remove photo' }).click();

    await expect(page.getByRole('heading', { name: 'Profile photo' })).toBeHidden();
    await expect(avatarButton.locator('img')).toHaveCount(0);
    await expect(avatarButton).toContainText('TE');
  });

  test('an unsupported file is rejected in the browser without a request', async ({ page }) => {
    await login(page);
    let uploads = 0;
    page.on('request', (request) => {
      if (request.url().endsWith('/api/me/avatar') && request.method() === 'PUT') {
        uploads++;
      }
    });

    await openDialog(page);
    await page.locator('.profile-photo-dialog__input').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });

    await expect(page.getByRole('alert')).toContainText('JPEG, PNG, WebP or GIF');
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(uploads).toBe(0);
  });
});
