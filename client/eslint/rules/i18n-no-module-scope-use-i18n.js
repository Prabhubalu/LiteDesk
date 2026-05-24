/**
 * @fileoverview Disallow vue-i18n useI18n() at module top level in plain JS/TS modules.
 *
 * Vue composables must run inside setup() or another composable invoked from setup.
 * <script setup> in .vue files is intentionally out of scope (top-level useI18n is valid there).
 */

const IGNORED_PATH_MARKERS = ['src/i18n/'];

/** @param {import('estree').Node | null | undefined} node */
function isInsideFunction(node) {
  let current = node?.parent;
  while (current) {
    if (
      current.type === 'FunctionDeclaration'
      || current.type === 'FunctionExpression'
      || current.type === 'ArrowFunctionExpression'
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/** @param {import('estree').CallExpression} node */
function isUseI18nCall(node) {
  return node.callee?.type === 'Identifier' && node.callee.name === 'useI18n';
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow useI18n() at module top level; call it inside a composable or setup function.',
    },
    messages: {
      moduleScope:
        'Call useI18n() inside a composable or setup function, not at module top level. '
        + 'In .vue files use <script setup>; in .js composables call it inside the exported function.',
    },
    schema: [],
  },
  create(context) {
    const filename = (context.filename || context.getFilename()).replace(/\\/g, '/');
    if (IGNORED_PATH_MARKERS.some((marker) => filename.includes(marker))) {
      return {};
    }

    return {
      CallExpression(node) {
        if (!isUseI18nCall(node) || isInsideFunction(node)) {
          return;
        }
        context.report({ node: node.callee, messageId: 'moduleScope' });
      },
    };
  },
};
