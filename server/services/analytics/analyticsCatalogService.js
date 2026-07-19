const { listAnalyticsModules } = require('./analyticsModuleRegistry');
const { listTenantAnalyticsModules } = require('./analyticsModuleCatalogService');
const { listConfiguredRelationships, listJoinTargetsForModule } = require('./analyticsRelationshipService');
const { loadModuleFields } = require('./analyticsFieldAccess');
const { filterFieldsByReadAccess } = require('../../utils/fieldAccessControl');

const USER_REFERENCE_FIELD_KEYS = new Set([
  'assignedto',
  'assignedby',
  'createdby',
  'updatedby',
  'modifiedby',
  'ownerid',
  'submittedby',
]);

function normalizeCatalogFieldKey(key) {
  return String(key || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function mapCatalogFieldOptions(field) {
  const raw = Array.isArray(field?.options) ? field.options : [];
  return raw
    .map((option) => {
      if (option == null) return null;
      if (typeof option === 'string' || typeof option === 'number' || typeof option === 'boolean') {
        const value = String(option);
        return { value, label: value };
      }
      if (typeof option !== 'object') return null;
      const value = option.value ?? option.id ?? option.key ?? option.name;
      if (value == null || value === '') return null;
      return {
        value: String(value),
        label: String(option.label ?? option.name ?? value),
      };
    })
    .filter(Boolean);
}

function mapCatalogFieldType(field) {
  const key = normalizeCatalogFieldKey(field?.key);
  const dataType = String(field?.dataType || field?.type || '').toLowerCase();
  if (USER_REFERENCE_FIELD_KEYS.has(key)) return 'user';
  if (String(field?.filterType || '').toLowerCase() === 'user') return 'user';
  if (String(field?.lookupSettings?.targetModule || '').toLowerCase() === 'users') return 'user';
  if (dataType.includes('user')) return 'user';
  if (
    dataType.includes('picklist') ||
    dataType === 'select' ||
    dataType === 'multiselect' ||
    dataType === 'multi-select' ||
    dataType === 'status' ||
    dataType === 'priority'
  ) {
    return dataType.includes('multi') ? 'multi-select' : 'picklist';
  }
  if (dataType.includes('boolean') || dataType === 'checkbox') return 'boolean';
  if (dataType.includes('date') || key.includes('date') || key.endsWith('at')) return 'date';
  if (
    dataType.includes('number') ||
    dataType.includes('currency') ||
    dataType.includes('percent') ||
    dataType.includes('integer') ||
    dataType.includes('decimal')
  ) {
    return dataType.includes('currency') ? 'currency' : 'number';
  }
  return 'string';
}

async function enrichModuleCatalog(organizationId, user) {
  const modules = await listTenantAnalyticsModules(organizationId);
  const enriched = [];

  for (const mod of modules) {
    const { fields, appKey } = await loadModuleFields(organizationId, mod.moduleKey);
    let readableFields = fields;
    if (user && fields.length) {
      readableFields = filterFieldsByReadAccess(fields, user, mod.moduleKey);
    }

    enriched.push({
      ...mod,
      fields: readableFields
        .map((f) => {
          const type = mapCatalogFieldType(f);
          const options = mapCatalogFieldOptions(f);
          return {
            key: f.key,
            label: f.label || f.key,
            type,
            filterable: f.filterable !== false,
            ...(options.length ? { options } : {}),
          };
        })
        .sort((a, b) => String(a.label).localeCompare(String(b.label))),
      joinTargets: await listJoinTargetsForModule(organizationId, mod.moduleKey),
    });
  }

  return enriched;
}

async function getAnalyticsCatalogPayload(organizationId, user) {
  return {
    modules: await enrichModuleCatalog(organizationId, user),
    relationships: await listConfiguredRelationships(organizationId),
  };
}

module.exports = {
  enrichModuleCatalog,
  getAnalyticsCatalogPayload,
};
