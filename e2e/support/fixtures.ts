import { test as base, expect } from '@playwright/test';

/**
 * Every spec except age-gate.spec.ts should import `test`/`expect` from here instead of
 * `@playwright/test` directly: it pre-confirms the age gate (see `AgeGateService`) before any
 * page script runs, so the rest of the suite doesn't have to click through the disclaimer modal.
 */
const AGE_GATE_STORAGE_KEY = 'age-gate-confirmed';

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, 'true');
    }, AGE_GATE_STORAGE_KEY);
    await use(page);
  },
});

export { expect };
