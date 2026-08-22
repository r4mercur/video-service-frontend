// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

const restrictedGlobalsMessage =
  'SSR-Regel (CLAUDE.md Abschnitt 6.1): Kein direkter Zugriff auf Browser-Globals. ' +
  'Nutze DOCUMENT-Token, isPlatformBrowser() oder den StorageService.';

module.exports = tseslint.config(
  {
    // Generiert via `npm run generate:api` — nicht Ziel unserer Stilregeln.
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
