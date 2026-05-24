/**
 * @fileoverview Block direct Intl/toLocaleString in Vue SFCs outside locale utils.
 */

const ALLOWED_PATH_MARKERS = [
  'utils/localeFormat',
  'utils/currencyOptions',
  'utils/appointmentFormatters',
  'utils/fieldDisplay',
  'utils/dateFilterOptions',
  'i18n/',
];

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use centralized locale formatters instead of direct toLocaleString/Intl in components.',
    },
    messages: {
      noDirectIntl:
        'Use useLocale() or @/utils/localeFormat instead of direct Intl/toLocaleString in UI code.',
    },
  },
  create(context) {
    const filename = (context.filename || context.getFilename()).replace(/\\/g, '/');
    if (ALLOWED_PATH_MARKERS.some((m) => filename.includes(m))) {
      return {};
    }
    if (!/\.(vue|ts|tsx)$/.test(filename)) return {};

    return {
      CallExpression(node) {
        const prop = node.callee?.property?.name;
        if (prop === 'toLocaleString' || prop === 'toLocaleDateString' || prop === 'toLocaleTimeString') {
          context.report({ node, messageId: 'noDirectIntl' });
        }
      },
      NewExpression(node) {
        if (node.callee?.name === 'Intl') {
          context.report({ node, messageId: 'noDirectIntl' });
        }
      },
    };
  },
};
