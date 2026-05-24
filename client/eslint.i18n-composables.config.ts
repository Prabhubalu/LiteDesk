/**
 * Minimal ESLint config for i18n composable scope checks (used by npm run i18n:eslint-composables).
 * Keeps i18n:check fast and avoids pulling in project-wide TypeScript rules.
 */
import tsParser from '@typescript-eslint/parser'
import { arivuI18nPlugin } from './eslint/plugins/arivu-i18n.js'

const moduleScopeRule = {
  'arivuI18n/no-module-scope-use-i18n': 'error' as const,
}

export default [
  {
    files: ['src/**/*.js'],
    ignores: ['src/i18n/**'],
    plugins: { arivuI18n: arivuI18nPlugin },
    rules: moduleScopeRule,
  },
  {
    files: ['src/composables/**/*.ts', 'src/**/composables/**/*.ts'],
    ignores: ['**/*.d.ts', 'src/i18n/**'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: { arivuI18n: arivuI18nPlugin },
    rules: moduleScopeRule,
  },
]
