'use strict';

const ModuleDefinition = require('../../../models/ModuleDefinition');
const RelationshipDefinition = require('../../../models/RelationshipDefinition');
const Organization = require('../../../models/Organization');
const {
  getModelForModuleKey,
  buildTenantScopedQuery
} = require('../../../utils/assignmentRecordLoader');

const CORE_EMAIL_MODULES = Object.freeze([
  'people',
  'organizations',
  'deals',
  'tasks',
  'cases',
  'workspace'
]);

function relationshipsIncludePeople(relationships) {
  if (!Array.isArray(relationships) || relationships.length === 0) return false;
  return relationships.some((rel) => {
    const target = String(
      rel?.targetModuleKey
      || rel?.target?.moduleKey
      || ''
    ).toLowerCase();
    const source = String(
      rel?.sourceModuleKey
      || rel?.source?.moduleKey
      || ''
    ).toLowerCase();
    return target === 'people' || source === 'people';
  });
}

/**
 * Email compose/send is allowed for:
 * - workspace / people
 * - any module whose ModuleDefinition (tenant or platform) lists a People relationship
 * - any module with an enabled platform RelationshipDefinition involving people
 */
async function isEmailEligibleModule({ organizationId, moduleKey }) {
  const key = String(moduleKey || '').trim().toLowerCase();
  if (!key) return false;
  if (key === 'workspace' || key === 'people') return true;

  if (organizationId) {
    const tenantMod = await ModuleDefinition.findOne({
      organizationId,
      key
    }).select('relationships').lean();
    if (relationshipsIncludePeople(tenantMod?.relationships)) return true;
  }

  const platformMods = await ModuleDefinition.find({
    organizationId: null,
    $or: [{ key }, { moduleKey: key }]
  }).select('relationships').lean();
  if (platformMods.some((m) => relationshipsIncludePeople(m.relationships))) {
    return true;
  }

  const relExists = await RelationshipDefinition.exists({
    enabled: { $ne: false },
    $or: [
      { 'source.moduleKey': key, 'target.moduleKey': 'people' },
      { 'target.moduleKey': key, 'source.moduleKey': 'people' }
    ]
  });
  return Boolean(relExists);
}

async function loadEmailRelatedRecord({ organizationId, moduleKey, recordId, findAccessibleOrganizationRecord }) {
  const key = String(moduleKey || '').trim().toLowerCase();
  if (!key || !recordId) return null;

  if (key === 'workspace') {
    if (String(recordId) !== String(organizationId)) return null;
    return Organization.findById(organizationId).select('_id name').lean();
  }

  if (key === 'organizations' || key === 'organization') {
    if (typeof findAccessibleOrganizationRecord === 'function') {
      return findAccessibleOrganizationRecord(organizationId, recordId);
    }
  }

  let Model = getModelForModuleKey(key);
  if (!Model && key === 'documents') {
    Model = require('../../../models/Document');
  }
  if (!Model) return null;

  const { query, requiresCreatedByTenantCheck } = buildTenantScopedQuery({
    organizationId,
    moduleKey: key,
    recordId,
    Model
  });

  const record = await Model.findOne(query).lean();
  if (!record) return null;

  if (requiresCreatedByTenantCheck) {
    if (!record.createdBy || !organizationId) return null;
    const User = require('../../../models/User');
    const allowed = await User.exists({ _id: record.createdBy, organizationId });
    return allowed ? record : null;
  }

  return record;
}

module.exports = {
  CORE_EMAIL_MODULES,
  relationshipsIncludePeople,
  isEmailEligibleModule,
  loadEmailRelatedRecord
};
