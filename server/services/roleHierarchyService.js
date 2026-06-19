/**
 * Role hierarchy helpers for sharing (descendant roles, users by role).
 */

const Role = require('../models/Role');
const User = require('../models/User');

const OWNER_NAMES = new Set(['owner']);
const ADMIN_NAMES = new Set(['admin', 'administrator']);
const MANAGER_NAMES = new Set(['manager', 'sales manager']);
const EXECUTIVE_NAMES = new Set(['user', 'sales executive']);
const READ_ONLY_NAMES = new Set(['viewer', 'read only']);

function normalizeRoleName(name) {
  return String(name || '').trim().toLowerCase();
}

function findRoleByNameSet(roles, nameSet) {
  for (const role of roles) {
    if (nameSet.has(normalizeRoleName(role.name))) return role;
  }
  return null;
}

function sortHierarchyChildren(children) {
  children.sort((a, b) => {
    const aOrder = Number.isFinite(a.sortOrder) ? a.sortOrder : 0;
    const bOrder = Number.isFinite(b.sortOrder) ? b.sortOrder : 0;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a.name).localeCompare(String(b.name));
  });
  for (const child of children) {
    if (child.children?.length) sortHierarchyChildren(child.children);
  }
}

function normalizeParentRoleId(parentRoleId) {
  return parentRoleId ? String(parentRoleId) : null;
}

const LEGACY_ENUM_ROLE_NAME_CANDIDATES = {
  owner: ['Owner'],
  admin: ['Administrator', 'Admin'],
  manager: ['Sales Manager', 'Manager'],
  user: ['Sales Executive', 'User'],
  viewer: ['Viewer', 'Read Only']
};

function resolveRoleForLegacyEnum(legacyEnum, roleByNormName, options = {}) {
  const key = String(legacyEnum || '').trim().toLowerCase();
  const candidates = LEGACY_ENUM_ROLE_NAME_CANDIDATES[key] || [];
  for (const name of candidates) {
    const role = roleByNormName.get(normalizeRoleName(name));
    if (role) return role;
  }
  if (options.isOwner) {
    return roleByNormName.get('owner') || null;
  }
  return null;
}

/**
 * Link users with legacy user.role enum but missing roleId.
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 */
async function backfillMissingUserRoleIds(organizationId, options = {}) {
  const RoleModel = options.RoleModel || Role;
  const UserModel = options.UserModel || User;
  const orgId = organizationId;

  const roles = await RoleModel.find({ organizationId: orgId }).select('_id name');
  const roleByNormName = new Map(roles.map((role) => [normalizeRoleName(role.name), role]));

  const users = await UserModel.find({
    organizationId: orgId,
    status: { $ne: 'inactive' },
    $or: [{ roleId: null }, { roleId: { $exists: false } }]
  }).select('_id role roleId isOwner');

  const saves = [];
  for (const user of users) {
    const targetRole = resolveRoleForLegacyEnum(user.role, roleByNormName, { isOwner: user.isOwner });
    if (!targetRole) continue;
    user.roleId = targetRole._id;
    saves.push(user.save());
  }

  if (saves.length) await Promise.all(saves);
  return { updated: saves.length };
}

function siblingQuery(organizationId, parentRoleId) {
  const parent = normalizeParentRoleId(parentRoleId);
  return parent
    ? { organizationId, parentRole: parent }
    : { organizationId, $or: [{ parentRole: null }, { parentRole: { $exists: false } }] };
}

/**
 * Backfill sortOrder for sibling groups that lack distinct ordering.
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 */
async function ensureSiblingSortOrders(organizationId, RoleModel = Role) {
  const roles = await RoleModel.find({ organizationId }).select('_id parentRole sortOrder name').sort({ sortOrder: 1, name: 1 });
  if (!roles.length) return { updated: 0 };

  const groups = new Map();
  for (const role of roles) {
    const parentKey = normalizeParentRoleId(role.parentRole);
    if (!groups.has(parentKey)) groups.set(parentKey, []);
    groups.get(parentKey).push(role);
  }

  const saves = [];
  for (const siblings of groups.values()) {
    siblings.sort((a, b) => {
      const aOrder = Number.isFinite(a.sortOrder) ? a.sortOrder : 0;
      const bOrder = Number.isFinite(b.sortOrder) ? b.sortOrder : 0;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return String(a.name).localeCompare(String(b.name));
    });
    siblings.forEach((role, index) => {
      if (role.sortOrder !== index) {
        role.sortOrder = index;
        saves.push(role.save());
      }
    });
  }

  if (saves.length) await Promise.all(saves);
  return { updated: saves.length };
}

/**
 * Reconcile Role.userCount from active users with roleId.
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 */
async function syncRoleUserCounts(organizationId, RoleModel = Role, UserModel = User) {
  const orgId = organizationId;
  await backfillMissingUserRoleIds(orgId, { RoleModel, UserModel });

  const grouped = await UserModel.aggregate([
    {
      $match: {
        organizationId: orgId,
        roleId: { $exists: true, $ne: null },
        status: { $ne: 'inactive' }
      }
    },
    { $group: { _id: '$roleId', count: { $sum: 1 } } }
  ]);

  const countsByRoleId = new Map(grouped.map((row) => [String(row._id), row.count]));
  const roles = await RoleModel.find({ organizationId: orgId }).select('_id userCount');
  const saves = [];

  for (const role of roles) {
    const nextCount = countsByRoleId.get(String(role._id)) || 0;
    if (role.userCount !== nextCount) {
      role.userCount = nextCount;
      saves.push(role.save());
    }
  }

  if (saves.length) await Promise.all(saves);
  return { updated: saves.length };
}

/**
 * Reorder a role among siblings (optionally changing parent).
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {string|import('mongoose').Types.ObjectId} roleId
 * @param {{ parentRoleId?: string|null, insertBeforeRoleId?: string|null, insertAfterRoleId?: string|null, RoleModel?: typeof Role }} options
 */
async function reorderSiblingRoles(organizationId, roleId, options = {}) {
  const RoleModel = options.RoleModel || Role;
  const movingRole = await RoleModel.findOne({ _id: roleId, organizationId });
  if (!movingRole) {
    const error = new Error('Role not found');
    error.code = 'ROLE_NOT_FOUND';
    throw error;
  }

  const parentRoleId = Object.prototype.hasOwnProperty.call(options, 'parentRoleId')
    ? normalizeParentRoleId(options.parentRoleId)
    : normalizeParentRoleId(movingRole.parentRole);

  const siblings = await RoleModel.find(siblingQuery(organizationId, parentRoleId))
    .sort({ sortOrder: 1, name: 1 });

  const movingId = String(movingRole._id);
  const ordered = siblings.filter((s) => String(s._id) !== movingId);

  let insertIndex = ordered.length;
  if (options.insertBeforeRoleId) {
    const idx = ordered.findIndex((s) => String(s._id) === String(options.insertBeforeRoleId));
    if (idx >= 0) insertIndex = idx;
  } else if (options.insertAfterRoleId) {
    const idx = ordered.findIndex((s) => String(s._id) === String(options.insertAfterRoleId));
    if (idx >= 0) insertIndex = idx + 1;
  }

  ordered.splice(insertIndex, 0, movingRole);

  const saves = [];
  for (let index = 0; index < ordered.length; index += 1) {
    const sibling = ordered[index];
    let changed = sibling.sortOrder !== index;
    if (String(sibling._id) === movingId) {
      const currentParent = normalizeParentRoleId(sibling.parentRole);
      if (currentParent !== parentRoleId) {
        sibling.parentRole = parentRoleId;
        changed = true;
      }
    }
    if (changed) {
      sibling.sortOrder = index;
      saves.push(sibling.save());
    }
  }

  if (saves.length) await Promise.all(saves);
  return movingRole;
}

/**
 * Repair standard template role parents:
 * Owner → Admin → { Manager → User, Viewer }
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {{ dryRun?: boolean, RoleModel?: typeof Role }} [options]
 */
async function repairStandardRoleHierarchy(organizationId, options = {}) {
  const RoleModel = options.RoleModel || Role;
  const dryRun = Boolean(options.dryRun);
  const roles = await RoleModel.find({ organizationId }).select('_id name parentRole level');
  if (!roles.length) return { repaired: false, changes: [] };

  const ownerRole = findRoleByNameSet(roles, OWNER_NAMES);
  const adminRole = findRoleByNameSet(roles, ADMIN_NAMES);
  const managerRole = findRoleByNameSet(roles, MANAGER_NAMES);
  const executiveRole = findRoleByNameSet(roles, EXECUTIVE_NAMES);
  const readOnlyRole = findRoleByNameSet(roles, READ_ONLY_NAMES);

  const expectedParents = new Map();
  if (ownerRole) expectedParents.set(String(ownerRole._id), null);
  if (adminRole) expectedParents.set(String(adminRole._id), ownerRole?._id || null);
  if (managerRole) expectedParents.set(String(managerRole._id), adminRole?._id || ownerRole?._id || null);
  if (executiveRole) {
    expectedParents.set(
      String(executiveRole._id),
      managerRole?._id || adminRole?._id || ownerRole?._id || null
    );
  }
  if (readOnlyRole) {
    expectedParents.set(String(readOnlyRole._id), adminRole?._id || ownerRole?._id || null);
  }

  const changes = [];
  const saves = [];

  for (const role of roles) {
    const roleId = String(role._id);
    if (!expectedParents.has(roleId)) continue;

    const expectedParent = expectedParents.get(roleId);
    const expectedParentId = expectedParent ? String(expectedParent) : null;
    const currentParentId = role.parentRole ? String(role.parentRole) : null;
    if (expectedParentId === currentParentId) continue;

    changes.push({
      roleId,
      roleName: role.name,
      fromParentId: currentParentId,
      toParentId: expectedParentId
    });

    if (!dryRun) {
      role.parentRole = expectedParent || null;
      saves.push(role.save());
    }
  }

  if (!dryRun && saves.length) await Promise.all(saves);

  return { repaired: changes.length > 0, changes };
}

/**
 * @param {object[]} roles — lean roles with _id, parentRole
 * @param {string|import('mongoose').Types.ObjectId} rootRoleId
 * @returns {string[]}
 */
function getDescendantRoleIdsFromRoles(roles, rootRoleId) {
  const root = String(rootRoleId || '');
  if (!root) return [];

  const childrenByParent = new Map();
  for (const role of roles || []) {
    const id = String(role._id);
    const parent = role.parentRole ? String(role.parentRole) : null;
    if (!parent) continue;
    if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
    childrenByParent.get(parent).push(id);
  }

  const out = new Set([root]);
  const queue = [root];
  while (queue.length) {
    const current = queue.shift();
    for (const child of childrenByParent.get(current) || []) {
      if (!out.has(child)) {
        out.add(child);
        queue.push(child);
      }
    }
  }
  return [...out];
}

/**
 * Role IDs visible under private sharing: same role + all descendants.
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {string|import('mongoose').Types.ObjectId} roleId
 */
async function getVisibleRoleIdsForPrivateSharing(organizationId, roleId) {
  if (!organizationId || !roleId) return [];
  const roles = await Role.find({ organizationId }).select('_id parentRole').lean();
  return getDescendantRoleIdsFromRoles(roles, roleId);
}

/**
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {Array<string|import('mongoose').Types.ObjectId>} roleIds
 * @returns {Promise<string[]>}
 */
async function getUserIdsByRoleIds(organizationId, roleIds) {
  const ids = (roleIds || []).map(String).filter(Boolean);
  if (!ids.length) return [];
  const users = await User.find({
    organizationId,
    roleId: { $in: ids },
    status: { $ne: 'inactive' }
  })
    .select('_id')
    .lean();
  return users.map((u) => u._id);
}

/**
 * True when newParentId is the role itself or any of its descendants.
 * @param {object[]} roles
 * @param {string|import('mongoose').Types.ObjectId} roleId
 * @param {string|import('mongoose').Types.ObjectId|null|undefined} newParentId
 */
function wouldCreateRoleHierarchyCycle(roles, roleId, newParentId) {
  if (!newParentId) return false;
  const movingId = String(roleId);
  const parentId = String(newParentId);
  if (movingId === parentId) return true;
  const descendants = getDescendantRoleIdsFromRoles(roles, movingId);
  return descendants.includes(parentId);
}

/**
 * Recompute `level` for every role in an organization from parent links.
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 */
async function recalculateOrganizationRoleLevels(organizationId) {
  const roles = await Role.find({ organizationId }).select('_id parentRole level');
  if (!roles.length) return;

  const byId = new Map(roles.map((r) => [String(r._id), r]));
  const memo = new Map();

  function computeLevel(id, visiting = new Set()) {
    if (memo.has(id)) return memo.get(id);
    if (visiting.has(id)) {
      memo.set(id, 0);
      return 0;
    }
    const role = byId.get(id);
    if (!role || !role.parentRole) {
      memo.set(id, 0);
      return 0;
    }
    const parentId = String(role.parentRole);
    const level = 1 + computeLevel(parentId, new Set([...visiting, id]));
    memo.set(id, level);
    return level;
  }

  const saves = [];
  for (const role of roles) {
    const id = String(role._id);
    const newLevel = computeLevel(id);
    if (role.level !== newLevel) {
      role.level = newLevel;
      saves.push(role.save());
    }
  }
  if (saves.length) await Promise.all(saves);
}

module.exports = {
  getDescendantRoleIdsFromRoles,
  getVisibleRoleIdsForPrivateSharing,
  getUserIdsByRoleIds,
  wouldCreateRoleHierarchyCycle,
  recalculateOrganizationRoleLevels,
  repairStandardRoleHierarchy,
  sortHierarchyChildren,
  normalizeRoleName,
  ensureSiblingSortOrders,
  reorderSiblingRoles,
  normalizeParentRoleId,
  syncRoleUserCounts,
  backfillMissingUserRoleIds
};
