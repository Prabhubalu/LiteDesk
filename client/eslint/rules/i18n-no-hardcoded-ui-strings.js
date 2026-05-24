/**
 * @fileoverview Disallow raw English UI strings in shared component surfaces.
 * @see client/docs/I18N_GUIDELINES.md
 */

const ENFORCEMENT_PATH_MARKERS = [
  'components/ui/',
  'layouts/',
  'components/common/',
  'components/modals/',
  'components/notifications/',
  'components/AppSidebar.vue',
  'components/AppSidebarSkeleton.vue',
  'components/TabBar.vue',
  'components/Nav.vue',
  'views/Login.vue',
  'components/LoginForm.vue',
  'views/Settings.vue',
  'components/settings/SettingsLandingPage.vue',
  'components/settings/AutomationSettings.vue',
  'components/settings/UsersAccessSettings.vue',
  'components/settings/PerformanceSettings.vue',
  'components/settings/ProfileSettings.vue',
  'components/settings/OrganizationSettings.vue',
  'components/settings/SecuritySettings.vue',
  'components/settings/UserManagement.vue',
  'components/settings/RolesPermissions.vue',
  'components/settings/RoleFormDrawer.vue',
  'components/settings/RoleUsersModal.vue',
  'components/settings/InviteUserModal.vue',
  'components/settings/EditUserModal.vue',
  'components/settings/GroupsSettings.vue',
  'components/groups/GroupFormModal.vue',
  'components/settings/HelpdeskExecutionSettings.vue',
  'components/settings/AssignmentRulesSettings.vue',
  'components/settings/HelpdeskSlaScheduleSection.vue',
  'components/settings/AppsSettings.vue',
  'components/settings/SalesSchema.vue',
  'components/settings/HelpdeskSchema.vue',
  'components/settings/HelpdeskAnalyticsDashboard.vue',
  'components/settings/SalesPipelines.vue',
  'components/settings/SalesPlaybooks.vue',
  'components/settings/ModulesAndFields.vue',
  'components/settings/BusinessHoursSettings.vue',
  'components/settings/CoreModulesList.vue',
  'components/settings/CoreEntities.vue',
  'components/settings/PlatformSettings.vue',
  'components/settings/ApplicationsList.vue',
  'components/settings/SubscriptionsList.vue',
  'components/settings/ModuleFormModal.vue',
  'components/settings/OrganizationHierarchy.vue',
  'components/settings/HierarchyNode.vue',
  'components/settings/SalesPeople.vue',
  'components/settings/AppManagement.vue',
  'components/settings/SubscriptionDetail.vue',
  'components/settings/AddCustomFieldDrawer.vue',
  'components/settings/RelationshipFormDrawer.vue',
  'components/settings/ApplicationDetail.vue',
];

const ALLOWLIST = new Set(['OK', 'ID', 'API', 'CRM', 'URL', 'UTC']);

function isEnforcementFile(filename) {
  const normalized = filename.replace(/\\/g, '/');
  return ENFORCEMENT_PATH_MARKERS.some((m) => normalized.includes(m));
}

function isExceptionFile(filename) {
  const normalized = filename.replace(/\\/g, '/');
  return (
    normalized.includes('.test.') ||
    normalized.includes('__tests__') ||
    normalized.includes('/debug/') ||
    normalized.includes('I18nDeveloperSettings')
  );
}

function looksLikeEnglishUi(text) {
  const value = text.trim();
  if (!value || value.length < 3) return false;
  if (ALLOWLIST.has(value)) return false;
  if (/^\{.*\}$/.test(value)) return false;
  if (/^[\d\s$%.]+$/.test(value)) return false;
  return /[a-zA-Z]/.test(value) && /[aeiou]/i.test(value);
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow hardcoded English UI strings in shared surfaces; use vue-i18n t() with ICU keys.',
    },
    schema: [],
    messages: {
      hardcodedTemplate: 'Hardcoded UI string "{{text}}". Use t() with a namespaced ICU key.',
      hardcodedAttr: 'Hardcoded {{attr}}="{{text}}". Use :{{attr}}="t(\'...\')".',
      concatTranslation: 'Do not concatenate translated strings. Use a single ICU template key.',
      directIntl: 'Do not call toLocaleString() in components. Use useLocale() formatters.',
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    if (!isEnforcementFile(filename) || isExceptionFile(filename)) {
      return {};
    }

    const sourceCode = context.sourceCode;

    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;
        if (!looksLikeEnglishUi(node.value)) return;

        if (node.parent?.type === 'Property' && ['label', 'title', 'placeholder'].includes(node.parent.key?.name)) {
          context.report({
            node,
            messageId: 'hardcodedAttr',
            data: { attr: node.parent.key.name, text: node.value.slice(0, 40) },
          });
        }
      },

      BinaryExpression(node) {
        if (node.operator !== '+') return;
        const hasTranslationCall = (n) => {
          if (!n) return false;
          if (n.type === 'CallExpression' && n.callee?.name === 't') return true;
          if (n.type === 'CallExpression' && n.callee?.property?.name === 't') return true;
          return false;
        };
        if (hasTranslationCall(node.left) || hasTranslationCall(node.right)) {
          context.report({ node, messageId: 'concatTranslation' });
        }
      },

      CallExpression(node) {
        if (
          node.callee?.type === 'MemberExpression' &&
          node.callee.property?.name === 'toLocaleString'
        ) {
          context.report({ node, messageId: 'directIntl' });
        }
      },

      VText(node) {
        const text = node.value?.trim?.() ?? '';
        if (looksLikeEnglishUi(text)) {
          context.report({
            node,
            messageId: 'hardcodedTemplate',
            data: { text: text.slice(0, 60) },
          });
        }
      },

      VAttribute(node) {
        if (!node.value || node.value.type !== 'VLiteral') return;
        const attr = node.key?.name;
        if (!['title', 'label', 'placeholder', 'aria-label'].includes(attr)) return;
        const text = node.value.value;
        if (looksLikeEnglishUi(text)) {
          context.report({
            node,
            messageId: 'hardcodedAttr',
            data: { attr, text: text.slice(0, 60) },
          });
        }
      },
    };
  },
};
