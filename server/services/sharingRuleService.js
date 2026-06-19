/**
 * Custom sharing rule evaluation — source owners + target membership.
 */

const mongoose = require('mongoose');
const Group = require('../models/Group');
const {
  getDescendantRoleIdsFromRoles,
  getUserIdsByRoleIds
} = require('./roleHierarchyService');

function resolveUserRoleId(user) {
  const rid = user?.roleId;
  if (!rid) return null;
  if (typeof rid === 'object' && rid._id) return String(rid._id);
  return String(rid);
}

function normalizePartyType(party) {
  return String(party?.type || '').toLowerCase();
}

/**
 * @param {object} user
 * @param {object} target
 * @param {object[]} rolesLean
 */
async function userMatchesRuleTarget(user, target, organizationId, rolesLean = []) {
  const type = normalizePartyType(target);
  if (!type || !user) return false;

  const userId = String(user._id);
  const userRoleId = resolveUserRoleId(user);

  if (type === 'all_internal') {
    return String(user.userType || 'INTERNAL').toUpperCase() !== 'EXTERNAL';
  }
  if (type === 'user') {
    return target.userId && String(target.userId) === userId;
  }
  if (type === 'role') {
    return userRoleId && target.roleId && userRoleId === String(target.roleId);
  }
  if (type === 'role_subtree') {
    if (!userRoleId || !target.roleId) return false;
    const subtree = getDescendantRoleIdsFromRoles(rolesLean, target.roleId);
    return subtree.includes(userRoleId);
  }
  if (type === 'group') {
    if (!target.groupId) return false;
    const group = await Group.findOne({
      _id: target.groupId,
      organizationId
    })
      .select('members')
      .lean();
    return (group?.members || []).some((m) => String(m) === userId);
  }
  return false;
}

/**
 * User IDs that own records matching the rule source.
 * @param {object} source
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {object[]} rolesLean
 */
async function resolveSourceOwnerUserIds(source, organizationId, rolesLean = []) {
  const type = normalizePartyType(source);
  if (!type || !organizationId) return [];

  if (type === 'user' && source.userId) {
    return [source.userId];
  }

  if (type === 'role' && source.roleId) {
    return getUserIdsByRoleIds(organizationId, [source.roleId]);
  }

  if (type === 'role_subtree' && source.roleId) {
    const roleIds = getDescendantRoleIdsFromRoles(rolesLean, source.roleId);
    return getUserIdsByRoleIds(organizationId, roleIds);
  }

  if (type === 'group' && source.groupId) {
    const group = await Group.findOne({
      _id: source.groupId,
      organizationId
    })
      .select('members')
      .lean();
    return (group?.members || []).filter((id) => mongoose.Types.ObjectId.isValid(id));
  }

  return [];
}

/**
 * @param {object} user — viewer
 * @param {object[]} rules — enabled rules for module
 * @param {string} ownerField
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {object[]} rolesLean
 * @returns {Promise<object[]>} Mongo filter clauses
 */
async function buildCustomGrantClauses(user, rules, ownerField, organizationId, rolesLean) {
  const clauses = [];
  const seenOwnerSets = new Set();

  for (const rule of rules || []) {
    if (!rule.enabled) continue;
    const matches = await userMatchesRuleTarget(user, rule.target, organizationId, rolesLean);
    if (!matches) continue;

    const ownerIds = await resolveSourceOwnerUserIds(rule.source, organizationId, rolesLean);
    const validIds = ownerIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (!validIds.length) continue;

    const key = validIds.map(String).sort().join(',');
    if (seenOwnerSets.has(key)) continue;
    seenOwnerSets.add(key);

    clauses.push({ [ownerField]: { $in: validIds } });
  }

  return clauses;
}

function validateRuleParty(party, allowedTypes, label) {
  const type = normalizePartyType(party);
  if (!allowedTypes.includes(type)) {
    return `${label} type is invalid`;
  }
  if (type === 'role' || type === 'role_subtree') {
    if (!party.roleId) return `${label} role is required`;
  }
  if (type === 'group' && !party.groupId) return `${label} group is required`;
  if (type === 'user' && !party.userId) return `${label} user is required`;
  return null;
}

module.exports = {
  userMatchesRuleTarget,
  resolveSourceOwnerUserIds,
  buildCustomGrantClauses,
  validateRuleParty,
  resolveUserRoleId
};
