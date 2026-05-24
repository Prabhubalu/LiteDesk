/**
 * Shared custom i18n ESLint plugin (single definition — required by ESLint flat config).
 */
import i18nNoHardcodedUiStrings from '../rules/i18n-no-hardcoded-ui-strings.js';
import i18nNoDirectIntl from '../rules/i18n-no-direct-intl.js';
import i18nNoModuleScopeUseI18n from '../rules/i18n-no-module-scope-use-i18n.js';

/** @type {import('eslint').ESLint.Plugin} */
export const arivuI18nPlugin = {
  rules: {
    'no-hardcoded-ui-strings': i18nNoHardcodedUiStrings,
    'no-direct-intl': i18nNoDirectIntl,
    'no-module-scope-use-i18n': i18nNoModuleScopeUseI18n,
  },
};
