/**
 * Sharing visibility resolver — builds Mongo filters for list queries.
 */

const mongoose = require('mongoose');
const ModuleSharingDefault = require('../models/ModuleSharingDefault');
const ModuleSharingRule = require('../models/ModuleSharingRule');
const Role = require('../models/Role');
const { isSharingV1Enabled, isRbacV2Enabled } = require('../utils/rbacFeatureFlags');
const { isTenantPrivilegedUser } = require('../utils/tenantPrivilegedAccess');
const {
  getVisibleRoleIdsForPrivateSharing,
  getUserIdsByRoleIds
} = require('./roleHierarchyService');
const { buildCustomGrantClauses } = require('./sharingRuleService');

const OWNER_FIELD_BY_MODULE = {
  deals: 'ownerId',
  people: 'assignedTo',
  contacts: 'assignedTo',
  cases: 'caseOwnerId',
  tasks: 'assignedTo',
  events: 'assignedTo',
  quotes: 'ownerId',
  sales_orders: 'ownerId',
  invoices: 'ownerId'
};

const PUBLIC_MODES = new Set([
  'public_read',
  'public_read_write',
  'public_read_write_delete'
]);

function normalizeModuleKey(moduleKey) {
  const k = String(moduleKey || '').toLowerCase();
  return k === 'contacts' ? 'people' : k;
}

function normalizeAppKey(appKey) {
  return appKey ? String(appKey).toUpperCase() : null;
}

function getOwnerFieldForModule(moduleKey) {
  const k = normalizeModuleKey(moduleKey);
  return OWNER_FIELD_BY_MODULE[k] || 'assignedTo';
}

function resolveUserRoleId(user) {
  const rid = user?.roleId;
  if (!rid) return null;
  if (typeof rid === 'object' && rid._id) return rid._id;
  return rid;
}

/**
 * @param {object} user
 * @param {object|null} [roleLean]
 * @param {object|null} [organization]
 */
function userBypassesSharing(user, roleLean = null, organization = null) {
  if (!user) return true;
  if (user.isOwner === true) return true;
  if (isTenantPrivilegedUser(user)) return true;

  const org = organization || user?.organization || null;
  if (!isRbacV2Enabled(org)) {
    if (user._canViewAllData === true) return true;
    if (roleLean?.canViewAllData === true) return true;
  }
  return false;
}

/**
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {string} appKey
 * @param {string} moduleKey
 */
async function getModuleSharingDefault(organizationId, appKey, moduleKey) {
  const upper = normalizeAppKey(appKey);
  const mod = normalizeModuleKey(moduleKey);
  if (!organizationId || !upper || !mod) return null;

  let row = await ModuleSharingDefault.findOne({
    organizationId,
    appKey: upper,
    moduleKey: mod
  }).lean();

  if (!row && mod === 'people') {
    row = await ModuleSharingDefault.findOne({
      organizationId,
      appKey: upper,
      moduleKey: 'contacts'
    }).lean();
  }

  return row;
}

async function getEnabledSharingRules(organizationId, appKey, moduleKey) {
  const upper = normalizeAppKey(appKey);
  const mod = normalizeModuleKey(moduleKey);
  if (!organizationId || !upper || !mod) return [];

  return ModuleSharingRule.find({
    organizationId,
    appKey: upper,
    moduleKey: mod,
    enabled: true
  })
    .sort({ priority: 1, createdAt: 1 })
    .lean();
}

/**
 * Base visibility from default mode only.
 */
async function buildBaseVisibilityFilter(user, params = {}) {
  const { appKey = 'SALES', moduleKey, organization = null, roleLean = null } = params;
  if (!user || !moduleKey) return null;
  if (!isSharingV1Enabled(organization)) return null;
  if (userBypassesSharing(user, roleLean, organization)) return null;

  const orgId = user.organizationId;
  const mod = normalizeModuleKey(moduleKey);
  const ownerField = getOwnerFieldForModule(mod);
  const userId = user._id;

  const row = await getModuleSharingDefault(orgId, appKey, mod);
  const mode = row?.mode || 'private';

  if (PUBLIC_MODES.has(mode)) {
    return null;
  }

  if (mode === 'record_level') {
    return { [ownerField]: userId };
  }

  if (mode === 'private') {
    const roleId = resolveUserRoleId(user);
    if (!roleId) {
      return { [ownerField]: userId };
    }

    const visibleRoleIds = await getVisibleRoleIdsForPrivateSharing(orgId, roleId);
    const visibleUserIds = await getUserIdsByRoleIds(orgId, visibleRoleIds);
    const ownerIds = [...new Set([String(userId), ...visibleUserIds.map(String)])];

    return {
      $or: [
        { [ownerField]: userId },
        { [ownerField]: { $in: ownerIds.filter((id) => mongoose.Types.ObjectId.isValid(id)) } }
      ]
    };
  }

  return { [ownerField]: userId };
}

function unionVisibilityFilters(baseFilter, grantClauses) {
  const clauses = [];
  if (baseFilter && Object.keys(baseFilter).length > 0) clauses.push(baseFilter);
  for (const grant of grantClauses || []) {
    if (grant && Object.keys(grant).length > 0) clauses.push(grant);
  }
  if (clauses.length === 0) return null;
  if (clauses.length === 1) return clauses[0];
  return { $or: clauses };
}

/**
 * Build Mongo filter clause for list visibility, or null when unrestricted.
 *
 * @param {object} user
 * @param {{ appKey?: string, moduleKey: string, organization?: object|null, roleLean?: object|null }} params
 * @returns {Promise<object|null>}
 */
async function buildRecordVisibilityFilter(user, params = {}) {
  const { appKey = 'SALES', moduleKey, organization = null, roleLean = null } = params;
  if (!user || !moduleKey) return null;

  if (!isSharingV1Enabled(organization)) return null;
  if (userBypassesSharing(user, roleLean, organization)) return null;

  const orgId = user.organizationId;
  const mod = normalizeModuleKey(moduleKey);
  const ownerField = getOwnerFieldForModule(mod);

  const baseFilter = await buildBaseVisibilityFilter(user, params);

  const rules = await getEnabledSharingRules(orgId, appKey, mod);
  if (!rules.length) return baseFilter;

  const rolesLean = await Role.find({ organizationId: orgId }).select('_id parentRole').lean();
  const grantClauses = await buildCustomGrantClauses(
    user,
    rules,
    ownerField,
    orgId,
    rolesLean
  );

  return unionVisibilityFilters(baseFilter, grantClauses);
}

async function buildSharingContext(user, params = {}) {
  const organization = params.organization || null;
  const bypass = userBypassesSharing(user, params.roleLean, organization);
  const defaultRow = user?.organizationId
    ? await getModuleSharingDefault(user.organizationId, params.appKey, params.moduleKey)
    : null;

  return {
    bypass,
    mode: defaultRow?.mode || 'private',
    ownerField: getOwnerFieldForModule(params.moduleKey),
    appKey: normalizeAppKey(params.appKey),
    moduleKey: normalizeModuleKey(params.moduleKey),
    sharingV1Enabled: isSharingV1Enabled(organization)
  };
}

module.exports = {
  OWNER_FIELD_BY_MODULE,
  getOwnerFieldForModule,
  getModuleSharingDefault,
  getEnabledSharingRules,
  userBypassesSharing,
  buildBaseVisibilityFilter,
  unionVisibilityFilters,
  buildRecordVisibilityFilter,
  buildSharingContext,
  normalizeModuleKey
};
