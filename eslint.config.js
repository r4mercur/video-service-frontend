// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

const restrictedGlobalsMessage =
  'SSR rule (CLAUDE.md section 6.1): no direct access to browser globals. ' +
  'Use the DOCUMENT token, isPlatformBrowser(), or StorageService instead.';

module.exports = tseslint.config(
  {
    // Generated via `npm run generate:api` — not subject to our style rules.
    ignores: ['src/app/core/api/schema.ts'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/prefer-standalone': 'error',
      '@angular-eslint/component-class-suffix': 'off',
      '@angular-eslint/directive-class-suffix': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
    },
  },
  {
    // The SSR rule (CLAUDE.md section 6.1) only applies to app source that could run on the
    // server. Playwright callbacks (e.g. `page.addInitScript`) execute in the browser page
    // context, never in our app bundle, so browser globals there are expected and safe.
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: restrictedGlobalsMessage },
        { name: 'document', message: restrictedGlobalsMessage },
        { name: 'localStorage', message: restrictedGlobalsMessage },
        { name: 'sessionStorage', message: restrictedGlobalsMessage },
        { name: 'navigator', message: restrictedGlobalsMessage },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {},
  },
);
