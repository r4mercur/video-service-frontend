import { expect, test as base } from '@playwright/test';

/**
 * Every spec except adult-content-preference.spec.ts should import `test`/`expect` from here
 * instead of `@playwright/test` directly: it pre-answers the adult-content dialog (see
 * `AdultContentPreferenceService`) before any page script runs, so the rest of the suite doesn't
 * have to click through the disclaimer modal.
 */
const ADULT_CONTENT_STORAGE_KEY = 'adult-content-preference';

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, 'true');
    }, ADULT_CONTENT_STORAGE_KEY);
    await use(page);
  },
});

export { expect };
