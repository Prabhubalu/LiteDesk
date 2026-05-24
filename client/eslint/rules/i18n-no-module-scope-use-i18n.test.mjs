#!/usr/bin/env node
/**
 * Smoke test for arivuI18n/no-module-scope-use-i18n (run: node eslint/rules/i18n-no-module-scope-use-i18n.test.mjs)
 */
import { RuleTester } from 'eslint';
import rule from './i18n-no-module-scope-use-i18n.js';

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

tester.run('no-module-scope-use-i18n', rule, {
  valid: [
    {
      code: `
        import { useI18n } from 'vue-i18n';
        export function useExample() {
          const { t } = useI18n();
          return t;
        }
      `,
      filename: '/project/src/composables/useExample.js',
    },
  ],
  invalid: [
    {
      code: `
        import { useI18n } from 'vue-i18n';
        const { t } = useI18n();
        export function useExample() {
          return t;
        }
      `,
      filename: '/project/src/composables/useExample.js',
      errors: [{ messageId: 'moduleScope' }],
    },
  ],
});

console.log('✅ i18n-no-module-scope-use-i18n rule tests passed');
