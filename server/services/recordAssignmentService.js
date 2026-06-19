/**
 * Record assignment policy (RBAC v2) — who an actor may assign records to.
 */

const Role = require('../models/Role');
const User = require('../models/User');
const { isRbacV2Enabled } = require('../utils/rbacFeatureFlags');
const { userBypassesSharing } = require('./sharingResolver');
const { getDescendantRoleIdsFromRoles } = require('./roleHierarchyService');
const { resolveRoleLeanWithProfile } = require('./roleProfileResolver');

function resolveActorRoleId(user) {
  if (!user) return null;
  if (user.roleId && typeof user.roleId === 'object') {
    return String(user.roleId._id || user.roleId);
  }
  if (user.roleId) return String(user.roleId);
  return null;
}

/**
 * Pure policy evaluation for unit tests.
 * @param {'all'|'same_role_or_hierarchy'|'subordinates_only'} policy
 * @param {string} actorRoleId
 * @param {string} targetRoleId
 * @param {object[]} rolesLean — _id, parentRole
 */
function evaluateUserAssignmentPolicy(policy, actorRoleId, targetRoleId, rolesLean) {
  if (policy === 'all') return true;
  const actorId = String(actorRoleId || '');
  const targetId = String(targetRoleId || '');
  if (!actorId || !targetId) return false;

  const visibleIds = getDescendantRoleIdsFromRoles(rolesLean, actorId);
  if (policy === 'same_role_or_hierarchy') {
    return visibleIds.includes(targetId);
  }
  if (policy === 'subordinates_only') {
    return visibleIds.filter((id) => id !== actorId).includes(targetId);
  }
  return true;
}

async function loadActorRoleLean(user, organization) {
  const roleId = resolveActorRoleId(user);
  if (!roleId || !user?.organizationId) return null;
  const role = await Role.findOne({
    _id: roleId,
    organizationId: user.organizationId
  }).lean();
  if (!role) return null;
  return resolveRoleLeanWithProfile(role, organization);
}

/**
 * @param {object} actorUser — req.user
 * @param {string|import('mongoose').Types.ObjectId} targetUserId
 * @param {{ organization?: object, roleLean?: object }} [options]
 * @returns {Promise<{ allowed: boolean, reason?: string, code?: string }>}
 */
async function canAssignRecordTo(actorUser, targetUserId, options = {}) {
  const organization = options.organization || null;
  if (!isRbacV2Enabled(organization)) {
    return { allowed: true };
  }

  const roleLean = options.roleLean || await loadActorRoleLean(actorUser, organization);
  if (userBypassesSharing(actorUser, roleLean, organization)) {
    return { allowed: true };
  }

  if (!targetUserId) {
    return {
      allowed: false,
      reason: 'Target user is required',
      code: 'ASSIGNMENT_USER_REQUIRED'
    };
  }

  const targetUser = await User.findOne({
    _id: targetUserId,
    organizationId: actorUser.organizationId,
    status: { $ne: 'inactive' }
  })
    .select('_id roleId')
    .lean();

  if (!targetUser) {
    return {
      allowed: false,
      reason: 'Target user not found or inactive',
      code: 'ASSIGNMENT_USER_NOT_FOUND'
    };
  }

  const policy = roleLean?.recordAssignment?.users || 'same_role_or_hierarchy';
  if (policy === 'all') return { allowed: true };

  const actorRoleId = resolveActorRoleId(actorUser);
  const targetRoleId = targetUser.roleId ? String(targetUser.roleId) : null;
  if (!actorRoleId || !targetRoleId) {
    return {
      allowed: false,
      reason: 'Role context required for assignment',
      code: 'ASSIGNMENT_ROLE_REQUIRED'
    };
  }

  const rolesLean = await Role.find({ organizationId: actorUser.organizationId })
    .select('_id parentRole')
    .lean();
  const allowed = evaluateUserAssignmentPolicy(policy, actorRoleId, targetRoleId, rolesLean);

  if (allowed) return { allowed: true };

  const reason = policy === 'subordinates_only'
    ? 'You can only assign to users in subordinate roles'
    : 'You can only assign to users in your role or subordinate roles';

  return {
    allowed: false,
    reason,
    code: 'ASSIGNMENT_NOT_ALLOWED'
  };
}

/**
 * @param {import('express').Request} req
 * @param {string|import('mongoose').Types.ObjectId|null|undefined} targetUserId
 * @param {{ skipSelf?: boolean }} [options]
 * @returns {Promise<{ status: number, body: object }|null>}
 */
async function validateRecordAssignmentRequest(req, targetUserId, options = {}) {
  if (!targetUserId) return null;
  const actorId = req.user?._id;
  if (options.skipSelf && actorId && String(targetUserId) === String(actorId)) {
    return null;
  }

  const organization = req.organization || null;
  const result = await canAssignRecordTo(req.user, targetUserId, { organization });
  if (result.allowed) return null;

  return {
    status: 403,
    body: {
      success: false,
      message: result.reason,
      code: result.code || 'ASSIGNMENT_NOT_ALLOWED'
    }
  };
}

module.exports = {
  resolveActorRoleId,
  evaluateUserAssignmentPolicy,
  canAssignRecordTo,
  validateRecordAssignmentRequest
};
