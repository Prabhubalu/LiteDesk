const { listAnalyticsModules } = require('./analyticsModuleRegistry');
const { listAnalyticsRelationships } = require('./analyticsRelationshipRegistry');
const { loadModuleFields } = require('./analyticsFieldAccess');
const { filterFieldsByReadAccess } = require('../../utils/fieldAccessControl');

async function enrichModuleCatalog(organizationId, user) {
  const modules = listAnalyticsModules();
  const enriched = [];

  for (const mod of modules) {
    const { fields, appKey } = await loadModuleFields(organizationId, mod.moduleKey);
    let readableFields = fields;
    if (user && fields.length) {
      readableFields = filterFieldsByReadAccess(fields, user, mod.moduleKey);
    }

    enriched.push({
      ...mod,
      fields: readableFields.map((f) => ({
        key: f.key,
        label: f.label || f.key,
        type: f.type || f.dataType || 'string',
        filterable: f.filterable !== false,
      })),
      joinTargets: listAnalyticsRelationships()
        .filter((rel) => rel.sourceModule === mod.moduleKey)
        .map((rel) => ({
          relationshipKey: rel.relationshipKey,
          targetModule: rel.targetModule,
          joinType: rel.joinType,
        })),
    });
  }

  return enriched;
}

async function getAnalyticsCatalogPayload(organizationId, user) {
  return {
    modules: await enrichModuleCatalog(organizationId, user),
    relationships: listAnalyticsRelationships(),
  };
}

module.exports = {
  enrichModuleCatalog,
  getAnalyticsCatalogPayload,
};
