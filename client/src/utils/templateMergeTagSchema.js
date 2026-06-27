import apiClient from '@/utils/apiClient';
import { fetchModulesListCached } from '@/utils/tenantSchemaApiCache';

const EXCLUDED_FIELD_KEYS = new Set([
  'participations',
  'activitylogs',
  'descriptionversions',
  'derivedstatus',
  'legacycontactid',
  'organizationid',
  'publicsharetoken',
  'customfields',
  '_id',
  '__v',
  'deletedat',
  'deletedby',
  'deletionreason'
]);

const LINE_ITEM_FIELDS = [
  { key: 'description', label: 'description' },
  { key: 'name', label: 'name' },
  { key: 'quantity', label: 'quantity' },
  { key: 'unitPrice', label: 'unitPrice' },
  { key: 'lineTotal', label: 'lineTotal' },
  { key: 'lineSubtotal', label: 'lineSubtotal' }
];

const LINE_COLLECTION_MODULES = new Set(['quotes', 'invoices', 'sales_orders']);

/** Runtime scope aliases — keep aligned with dataProviderEngine. */
const MODULE_MERGE_ALIASES = {
  quotes: 'Quote',
  invoices: 'Invoice',
  sales_orders: 'SalesOrder',
  people: 'People',
  organizations: 'Organization'
};

/**
 * @param {string} moduleKey
 * @returns {string}
 */
export function resolveMergeTagModuleAlias(moduleKey) {
  const key = String(moduleKey || '').trim().toLowerCase();
  if (MODULE_MERGE_ALIASES[key]) return MODULE_MERGE_ALIASES[key];
  return capitalizeModuleAlias(moduleKey);
}

/**
 * @param {string} moduleKey
 * @returns {string}
 */
export function capitalizeModuleAlias(moduleKey) {
  const key = String(moduleKey || '').trim();
  if (!key) return 'Record';
  return key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * @param {import('vue-i18n').Composer['t']} t
 * @param {import('vue-i18n').Composer['te']} te
 * @param {(moduleKey: string) => string | undefined} getModuleLabelKey
 */
export function resolveModuleOptionLabel(t, te, getModuleLabelKey, module) {
  const key = String(module?.key || module?.moduleKey || '').toLowerCase();
  const labelKey = getModuleLabelKey(key);
  if (labelKey && te(labelKey)) return t(labelKey);
  return module?.name || module?.label || key;
}

/**
 * @param {string} key
 * @returns {string}
 */
export function humanizeFieldKey(key) {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * @param {object} field
 * @param {string} moduleKey
 */
export function isMergeTagEligibleField(field, moduleKey) {
  const key = String(field?.key || '').trim();
  if (!key) return false;
  if (EXCLUDED_FIELD_KEYS.has(key.toLowerCase())) return false;
  if (field?.type === 'participation') return false;
  if (moduleKey === 'users' && !key) return false;
  return true;
}

/**
 * @param {object} moduleDef
 * @param {string} moduleKey
 */
function collectRelatedModuleKeys(moduleDef, moduleKey) {
  const keys = new Set();
  const normalizedScope = String(moduleKey || '').toLowerCase();

  for (const rel of moduleDef?.relationships || []) {
    const target = String(rel?.targetModuleKey || rel?.targetModule || '').toLowerCase();
    if (target && target !== normalizedScope) keys.add(target);
  }

  for (const field of moduleDef?.fields || []) {
    const lookupTarget = field?.lookupModule || field?.targetModule || field?.ref;
    const target = String(lookupTarget || '').toLowerCase();
    if (target && target !== normalizedScope) keys.add(target);
  }

  return [...keys];
}

/**
 * @param {string} moduleKey
 * @returns {Promise<object|null>}
 */
export async function fetchModuleDefinition(moduleKey) {
  const key = String(moduleKey || '').trim().toLowerCase();
  if (!key) return null;

  const response = await apiClient.get('/modules', {
    params: { key, context: 'all', purpose: 'merge-tags' },
    cache: 'no-store'
  });

  const rows = Array.isArray(response?.data) ? response.data : [];
  return rows.find((row) => String(row?.key || row?.moduleKey || '').toLowerCase() === key) || rows[0] || null;
}

/**
 * @returns {Promise<Array<{ key: string, name: string, label: string, enabled: boolean }>>}
 */
export async function fetchAllModuleOptions(t, te, getModuleLabelKey) {
  const response = await fetchModulesListCached({ context: 'all' });
  const rows = Array.isArray(response?.data) ? response.data : [];

  return rows
    .filter((row) => row?.key || row?.moduleKey)
    .map((row) => {
      const key = String(row.key || row.moduleKey).toLowerCase();
      return {
        key,
        name: row.name || key,
        label: resolveModuleOptionLabel(t, te, getModuleLabelKey, row),
        enabled: row.enabled !== false
      };
    })
    .filter((row) => row.enabled)
    .sort((a, b) => a.label.localeCompare(b.label));
}

function resolveFieldLabel(field) {
  return field.label || field.displayName || field.name || humanizeFieldKey(field.key);
}

function buildFieldNodes(moduleKey, fields) {
  const alias = resolveMergeTagModuleAlias(moduleKey);
  return fields.map((field) => ({
    id: `${moduleKey}-${field.key}`,
    path: `${alias}.${field.key}`,
    label: resolveFieldLabel(field),
    moduleKey
  }));
}

function buildLineItemsGroup(moduleKey) {
  return {
    id: `lines-${moduleKey}`,
    moduleKey: 'lines',
    labelKey: 'templates.builderMergeGroupLines',
    children: LINE_ITEM_FIELDS.map((field) => ({
      id: `line-${moduleKey}-${field.key}`,
      path: `line.${field.key}`,
      label: field.label
    }))
  };
}

/**
 * @param {string} moduleScope
 * @returns {Promise<Array<object>>}
 */
export async function buildMergeTagTreeGroups(moduleScope) {
  const systemGroup = {
    id: 'system',
    moduleKey: 'system',
    labelKey: 'templates.builderMergeGroupSystem',
    children: [
      { id: 'system-today', path: 'System.Today', label: 'Today' },
      { id: 'system-now', path: 'System.Now', label: 'Now' },
      { id: 'system-pages', path: 'System.PageCount', label: 'PageCount' }
    ]
  };

  const organizationGroup = {
    id: 'organization',
    moduleKey: 'organization',
    labelKey: 'templates.builderMergeGroupOrganization',
    children: [
      { id: 'org-name', path: 'Organization.name', label: 'name' },
      { id: 'org-email', path: 'Organization.email', label: 'email' },
      { id: 'org-industry', path: 'Organization.industry', label: 'industry' }
    ]
  };

  const currentContextGroup = {
    id: 'current-context',
    moduleKey: 'current-context',
    labelKey: 'templates.builderMergeGroupCurrentContext',
    children: [
      { id: 'current-user-email', path: 'CurrentUser.email', label: 'email' },
      { id: 'current-user-name', path: 'CurrentUser.firstName', label: 'firstName' },
      { id: 'current-org-name', path: 'CurrentOrganization.name', label: 'name' }
    ]
  };

  const groups = [systemGroup, organizationGroup, currentContextGroup];
  const moduleKey = String(moduleScope || '').trim().toLowerCase();
  if (!moduleKey) return groups;

  const primaryModule = await fetchModuleDefinition(moduleKey);
  if (!primaryModule) return groups;

  const primaryFields = (primaryModule.fields || []).filter((field) =>
    isMergeTagEligibleField(field, moduleKey)
  );

  if (primaryFields.length) {
    groups.push({
      id: `module-${moduleKey}`,
      moduleKey,
      label: primaryModule.name || capitalizeModuleAlias(moduleKey),
      children: buildFieldNodes(moduleKey, primaryFields)
    });
  }

  const relatedKeys = collectRelatedModuleKeys(primaryModule, moduleKey);
  const relatedDefinitions = await Promise.all(
    relatedKeys.map(async (relatedKey) => ({
      relatedKey,
      definition: await fetchModuleDefinition(relatedKey)
    }))
  );

  for (const { relatedKey, definition } of relatedDefinitions) {
    if (!definition) continue;

    const relatedFields = (definition.fields || []).filter((field) =>
      isMergeTagEligibleField(field, relatedKey)
    );
    if (!relatedFields.length) continue;

    const relationship = (primaryModule.relationships || []).find((rel) => {
      const target = String(rel?.targetModuleKey || rel?.targetModule || '').toLowerCase();
      return target === relatedKey;
    });

    groups.push({
      id: `related-${moduleKey}-${relatedKey}`,
      moduleKey: relatedKey,
      label: relationship?.label || relationship?.name || definition.name || capitalizeModuleAlias(relatedKey),
      children: buildFieldNodes(relatedKey, relatedFields)
    });
  }

  if (LINE_COLLECTION_MODULES.has(moduleKey)) {
    groups.push(buildLineItemsGroup(moduleKey));
  }

  return groups;
}

/**
 * @param {Array<object>} nodes
 * @param {import('vue-i18n').Composer['t']} t
 * @returns {Array<{ id: string, label: string, moduleKey: string, fields: Array<object> }>}
 */
export function flattenMergeTagTreeGroups(nodes, t) {
  const groups = [];

  for (const node of nodes || []) {
    if (!Array.isArray(node.children) || !node.children.length) continue;

    const leafFields = node.children.filter((child) => child.path && !child.children?.length);
    const nestedGroups = node.children.filter((child) => child.children?.length);
    const groupLabel = node.labelKey ? t(node.labelKey) : (node.label || '');

    if (leafFields.length) {
      groups.push({
        id: node.id,
        label: groupLabel,
        moduleKey: String(node.moduleKey || '').toLowerCase(),
        fields: leafFields.map((field) => {
          const label = field.label || field.path;
          const path = field.path || '';
          const key = String(field.key || path.split('.').pop() || '');
          const searchText = `${groupLabel} ${label} ${path} ${humanizeFieldKey(key)}`.toLowerCase();
          return {
            ...field,
            groupId: node.id,
            groupLabel,
            searchText
          };
        })
      });
    }

    groups.push(...flattenMergeTagTreeGroups(nestedGroups, t));
  }

  return groups;
}
