import { expect, test } from '@playwright/test';

// Deliberately uses raw @playwright/test, not ./support/fixtures — that fixture pre-answers the
// dialog for every other spec, which is exactly the behavior under test here.
test.describe('Adult content preference dialog', () => {
  test('shows on first visit, dimming the page behind it without hiding it', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Adult content' })).toBeVisible();
    // The page behind the dialog is still rendered and visible (dimmed via the native
    // `::backdrop`)...
    await expect(page.getByRole('link', { name: 'Browse' })).toBeVisible();
    // ...but not interactive: a modal `<dialog>` sits in the top layer and intercepts pointer
    // events, so a click on anything behind it never reaches its target.
    await expect(
      page.getByRole('link', { name: 'Browse' }).click({ timeout: 2000 }),
    ).rejects.toThrow();
    await expect(page).toHaveURL('/catalog');
  });

  test('declining closes the dialog, leaves the app usable (no navigation away), and filters adult content', async ({
    page,
  }) => {
    await page.goto('/');

    const requestWithoutFlag = page.waitForRequest(
      (request) =>
        request.url().includes('/api/videos') &&
        request.url().includes('includeAgeRestricted=false'),
    );
    await page.getByRole('button', { name: 'No, keep it hidden' }).click();
    await expect(page.getByRole('heading', { name: 'Adult content' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse' })).toBeVisible();
    await expect(page).toHaveURL('/catalog');
    await requestWithoutFlag;

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Adult content' })).not.toBeVisible();
  });

  test('confirming reveals the app, persists across reload, and includes adult content in requests', async ({
    page,
  }) => {
    await page.goto('/');

    const requestWithFlag = page.waitForRequest(
      (request) =>
        request.url().includes('/api/videos') &&
        request.url().includes('includeAgeRestricted=true'),
    );
    await page.getByRole('button', { name: 'Yes, show it to me' }).click();
    await expect(page.getByRole('heading', { name: 'Adult content' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse' })).toBeVisible();
    await requestWithFlag;

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Adult content' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse' })).toBeVisible();
  });

  test('Escape does not dismiss the dialog', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Adult content' })).toBeVisible();
  });
});
