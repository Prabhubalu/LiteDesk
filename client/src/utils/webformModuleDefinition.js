import { mergePeopleVirtualFieldDefinitions } from '@/platform/fields/peopleFieldRegistry';
import { fetchModuleDefinitionCached } from '@/utils/tenantSchemaApiCache';

/**
 * Load full module definition for webform builder (all fields, tenant overrides).
 * @param {string} moduleKey
 * @returns {Promise<{ moduleRow: object|null, fields: object[] }>}
 */
export async function fetchWebformModuleDefinition(moduleKey) {
  const key = String(moduleKey || '').toLowerCase().trim();
  if (!key) {
    return { moduleRow: null, fields: [] };
  }

  const moduleRow = await fetchModuleDefinitionCached(key, { context: 'all' });
  let fields = Array.isArray(moduleRow?.fields) ? moduleRow.fields : [];

  if (key === 'people') {
    fields = mergePeopleVirtualFieldDefinitions(fields);
  }

  return { moduleRow, fields };
}

export function webformModuleOptionValue(moduleKey, appKey) {
  return `${String(appKey || '').toUpperCase()}:${String(moduleKey || '').toLowerCase()}`;
}

export function parseWebformModuleOptionValue(value) {
  const raw = String(value || '').trim();
  const sep = raw.indexOf(':');
  if (sep <= 0) {
    return { moduleKey: raw.toLowerCase(), appKey: '' };
  }
  return {
    appKey: raw.slice(0, sep).toUpperCase(),
    moduleKey: raw.slice(sep + 1).toLowerCase()
  };
}
