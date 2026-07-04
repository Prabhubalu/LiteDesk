const { listAnalyticsModules } = require('./analyticsModuleRegistry');
const { listTenantAnalyticsModules } = require('./analyticsModuleCatalogService');
const { listConfiguredRelationships, listJoinTargetsForModule } = require('./analyticsRelationshipService');
const { loadModuleFields } = require('./analyticsFieldAccess');
const { filterFieldsByReadAccess } = require('../../utils/fieldAccessControl');

const USER_REFERENCE_FIELD_KEYS = new Set([
  'assignedto',
  'createdby',
  'updatedby',
  'modifiedby',
  'ownerid',
  'submittedby',
]);

function mapCatalogFieldType(field) {
  const key = String(field?.key || '').toLowerCase();
  const dataType = String(field?.dataType || field?.type || '').toLowerCase();
  if (USER_REFERENCE_FIELD_KEYS.has(key)) return 'user';
  if (String(field?.filterType || '').toLowerCase() === 'user') return 'user';
  if (String(field?.lookupSettings?.targetModule || '').toLowerCase() === 'users') return 'user';
  if (dataType.includes('user')) return 'user';
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
        .map((f) => ({
          key: f.key,
          label: f.label || f.key,
          type: mapCatalogFieldType(f),
          filterable: f.filterable !== false,
        }))
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
