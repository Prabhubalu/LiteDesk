const People = require('../../models/People');
const Organization = require('../../models/Organization');

const CRM_ORG_MATCH = { isTenant: { $ne: true } };

/**
 * Cross-module join definitions for analytics (1-hop and chained 2-hop).
 * Keys: `${sourceModule}:${targetModule}`
 */
const ANALYTICS_CROSS_MODULE_JOINS = Object.freeze({
  'cases:people': {
    relationshipKey: 'case_people',
    sourceModule: 'cases',
    targetModule: 'people',
    localField: 'contactId',
    targetCollection: 'people',
    targetModel: People,
    joinAs: '_analytics_join_people',
  },
  'cases:organizations': {
    relationshipKey: 'case_organizations',
    sourceModule: 'cases',
    targetModule: 'organizations',
    localField: 'organizationRefId',
    targetCollection: 'organizations',
    targetModel: Organization,
    joinAs: '_analytics_join_organizations',
    targetMatch: CRM_ORG_MATCH,
  },
  'deals:people': {
    relationshipKey: 'deal_people',
    sourceModule: 'deals',
    targetModule: 'people',
    localField: 'contactId',
    targetCollection: 'people',
    targetModel: People,
    joinAs: '_analytics_join_people',
  },
  'deals:organizations': {
    relationshipKey: 'deal_organizations',
    sourceModule: 'deals',
    targetModule: 'organizations',
    localField: 'accountId',
    targetCollection: 'organizations',
    targetModel: Organization,
    joinAs: '_analytics_join_organizations',
    targetMatch: CRM_ORG_MATCH,
  },
  'people:organizations': {
    relationshipKey: 'people_organizations',
    sourceModule: 'people',
    targetModule: 'organizations',
    localField: 'organization',
    targetCollection: 'organizations',
    targetModel: Organization,
    joinAs: '_analytics_join_organizations',
    targetMatch: CRM_ORG_MATCH,
  },
});

function listAnalyticsRelationships() {
  return Object.values(ANALYTICS_CROSS_MODULE_JOINS).map((join) => ({
    relationshipKey: join.relationshipKey,
    sourceModule: join.sourceModule,
    targetModule: join.targetModule,
    joinType: 'left',
    localField: join.localField,
    requiresJoin: join.requiresJoin || null,
    chained: Boolean(join.joinFromAlias),
  }));
}

function getCrossModuleJoin(sourceModule, targetModule) {
  const key = `${String(sourceModule || '').toLowerCase()}:${String(targetModule || '').toLowerCase()}`;
  return ANALYTICS_CROSS_MODULE_JOINS[key] || null;
}

function listJoinsForSource(sourceModule) {
  const source = String(sourceModule || '').toLowerCase();
  return Object.values(ANALYTICS_CROSS_MODULE_JOINS).filter((j) => j.sourceModule === source);
}

function sortJoinModules(primaryModule, joinModules) {
  const joins = joinModules
    .map((mod) => getCrossModuleJoin(primaryModule, mod))
    .filter(Boolean);

  const ordered = [];
  const seen = new Set();

  function visit(targetModule) {
    const mod = String(targetModule).toLowerCase();
    if (seen.has(mod)) return;
    const join = getCrossModuleJoin(primaryModule, mod);
    if (!join) return;
    if (join.requiresJoin && !seen.has(join.requiresJoin)) {
      visit(join.requiresJoin);
    }
    seen.add(mod);
    ordered.push(mod);
  }

  for (const mod of joinModules) visit(mod);
  return ordered;
}

module.exports = {
  ANALYTICS_CROSS_MODULE_JOINS,
  listAnalyticsRelationships,
  getCrossModuleJoin,
  listJoinsForSource,
  sortJoinModules,
};
