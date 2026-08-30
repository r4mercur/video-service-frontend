import { expect, test } from '@playwright/test';

// Deliberately uses raw @playwright/test, not ./support/fixtures — that fixture pre-confirms
// the gate for every other spec, which is exactly the behavior under test here.
test.describe('Age gate', () => {
  test('shows on first visit, dimming the page behind it without hiding it', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Age verification' })).toBeVisible();
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

  test('confirming reveals the app and persists across reload', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: "Yes, I'm 18 or older" }).click();
    await expect(page.getByRole('heading', { name: 'Age verification' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Age verification' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse' })).toBeVisible();
  });

  test('declining navigates away from the app', async ({ page }) => {
    await page.route('https://www.google.com/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>stub</h1>' });
    });

    await page.goto('/');
    await page.getByRole('button', { name: "No, I'm not" }).click();

    await expect(page).toHaveURL(/^https:\/\/www\.google\.com/);
  });

  test('Escape does not dismiss the gate', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Age verification' })).toBeVisible();
  });
});
