const mongoose = require('mongoose');
const { isTenantPrivilegedUser } = require('../../utils/tenantPrivilegedAccess');
const { getUserGroupIds } = require('../../utils/documentVisibility');
const { hasAnalyticsPermission, ANALYTICS_MODULE_KEYS } = require('../../permissions/analyticsPermissions');

const DEFAULT_REPORT_PERMISSIONS = Object.freeze({
  view: 'viewers',
  edit: 'editors',
  clone: 'viewers',
  export: 'viewers',
  share: 'owner',
});

function resolveUserRoleId(user) {
  const rid = user?.roleId;
  if (!rid) return null;
  if (typeof rid === 'object' && rid._id) return String(rid._id);
  return String(rid);
}

function isReportOwner(user, report) {
  if (!user || !report) return false;
  const userId = String(user._id || user.id || '');
  if (!userId) return false;
  if (String(report.ownerId || '') === userId) return true;
  if (String(report.createdBy || '') === userId) return true;
  return false;
}

function userBypassesReportSharing(user) {
  if (!user) return true;
  if (user.isOwner === true) return true;
  return isTenantPrivilegedUser(user);
}

function userPermissionsPlain(user) {
  const p = user?.permissions;
  if (!p) return {};
  return typeof p.toObject === 'function' ? p.toObject() : { ...p };
}

function hasReportUpdatePermission(user) {
  if (userBypassesReportSharing(user)) return true;
  return hasAnalyticsPermission(
    userPermissionsPlain(user),
    ANALYTICS_MODULE_KEYS.REPORTS,
    'update',
  );
}

function hasReportExportPermission(user) {
  if (userBypassesReportSharing(user)) return true;
  return hasAnalyticsPermission(
    userPermissionsPlain(user),
    ANALYTICS_MODULE_KEYS.REPORTS,
    'export',
  );
}

function normalizeReportPermissions(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_REPORT_PERMISSIONS };
  }

  const normalized = { ...DEFAULT_REPORT_PERMISSIONS };
  for (const key of Object.keys(DEFAULT_REPORT_PERMISSIONS)) {
    const value = raw[key];
    if (value === true || value === 'viewers') normalized[key] = 'viewers';
    else if (value === 'editors') normalized[key] = 'editors';
    else if (value === 'owner' || value === false) normalized[key] = 'owner';
  }
  return normalized;
}

function sharedTargetIds(sharedWith, type) {
  if (!Array.isArray(sharedWith)) return [];
  return sharedWith
    .filter((entry) => entry && entry.type === type && entry.id)
    .map((entry) => String(entry.id));
}

function matchesTeamVisibility(report, userGroupIds) {
  const teamIds = sharedTargetIds(report.sharedWith, 'team');
  if (!teamIds.length) return false;
  const groupSet = new Set((userGroupIds || []).map(String));
  return teamIds.some((id) => groupSet.has(id));
}

function matchesRoleVisibility(report, userRoleId) {
  if (!userRoleId) return false;
  const roleIds = sharedTargetIds(report.sharedWith, 'role');
  return roleIds.includes(String(userRoleId));
}

function matchesUserVisibility(report, userId) {
  if (!userId) return false;
  const userIds = sharedTargetIds(report.sharedWith, 'user');
  return userIds.includes(String(userId));
}

function passesVisibility(user, report, context = {}) {
  if (!report) return false;
  if (userBypassesReportSharing(user)) return true;
  if (isReportOwner(user, report)) return true;

  const visibility = String(report.visibility || 'private').toLowerCase();
  const userId = String(user?._id || user?.id || '');
  const userRoleId = context.userRoleId ?? resolveUserRoleId(user);
  const userGroupIds = context.userGroupIds || [];

  if (matchesUserVisibility(report, userId)) return true;

  switch (visibility) {
    case 'organization':
      return report.status === 'published';
    case 'team':
      return report.status === 'published' && matchesTeamVisibility(report, userGroupIds);
    case 'role':
      return report.status === 'published' && matchesRoleVisibility(report, userRoleId);
    case 'private':
    default:
      return false;
  }
}

function passesPermissionLevel(user, report, action) {
  if (isReportOwner(user, report)) return true;
  const perms = normalizeReportPermissions(report.permissions);
  const level = perms[action] || DEFAULT_REPORT_PERMISSIONS[action] || 'viewers';
  if (level === 'owner') return false;
  if (level === 'editors') return hasReportUpdatePermission(user);
  return true;
}

async function buildReportAccessContext(user, organizationId) {
  const userId = user?._id || user?.id;
  return {
    userRoleId: resolveUserRoleId(user),
    userGroupIds: userId ? await getUserGroupIds(organizationId, userId) : [],
  };
}

async function canViewReport(user, report, organizationId) {
  const context = await buildReportAccessContext(user, organizationId);
  if (!passesVisibility(user, report, context)) return false;
  return passesPermissionLevel(user, report, 'view');
}

async function canEditReport(user, report, organizationId) {
  const context = await buildReportAccessContext(user, organizationId);
  if (!passesVisibility(user, report, context)) return false;
  if (!hasReportUpdatePermission(user)) return false;
  return passesPermissionLevel(user, report, 'edit');
}

async function canExportReport(user, report, organizationId) {
  const context = await buildReportAccessContext(user, organizationId);
  if (!passesVisibility(user, report, context)) return false;
  if (!hasReportExportPermission(user)) return false;
  return passesPermissionLevel(user, report, 'export');
}

async function canCloneReport(user, report, organizationId) {
  const context = await buildReportAccessContext(user, organizationId);
  if (!passesVisibility(user, report, context)) return false;
  return passesPermissionLevel(user, report, 'clone');
}

async function canShareReport(user, report, organizationId) {
  const context = await buildReportAccessContext(user, organizationId);
  if (!passesVisibility(user, report, context)) return false;
  if (!hasReportUpdatePermission(user)) return false;
  return passesPermissionLevel(user, report, 'share');
}

async function assertReportViewAccess(user, report, organizationId) {
  const allowed = await canViewReport(user, report, organizationId);
  if (!allowed) {
    const err = new Error('You do not have access to this report');
    err.statusCode = 403;
    err.code = 'REPORT_ACCESS_DENIED';
    throw err;
  }
}

async function assertReportEditAccess(user, report, organizationId) {
  const allowed = await canEditReport(user, report, organizationId);
  if (!allowed) {
    const err = new Error('You do not have permission to edit this report');
    err.statusCode = 403;
    err.code = 'REPORT_EDIT_DENIED';
    throw err;
  }
}

async function assertReportExportAccess(user, report, organizationId) {
  const allowed = await canExportReport(user, report, organizationId);
  if (!allowed) {
    const err = new Error('You do not have permission to export this report');
    err.statusCode = 403;
    err.code = 'REPORT_EXPORT_DENIED';
    throw err;
  }
}

async function assertReportCloneAccess(user, report, organizationId) {
  await assertReportViewAccess(user, report, organizationId);
  const allowed = await canCloneReport(user, report, organizationId);
  if (!allowed) {
    const err = new Error('You do not have permission to clone this report');
    err.statusCode = 403;
    err.code = 'REPORT_CLONE_DENIED';
    throw err;
  }
}

async function buildReportListVisibilityFilter(user, organizationId) {
  if (userBypassesReportSharing(user)) {
    return { organizationId };
  }

  const userId = user?._id || user?.id;
  const context = await buildReportAccessContext(user, organizationId);
  const userObjectId = userId ? new mongoose.Types.ObjectId(String(userId)) : null;
  const roleId = context.userRoleId;
  const groupIds = (context.userGroupIds || []).filter(Boolean).map(String);

  const orClauses = [];

  if (userObjectId) {
    orClauses.push({ ownerId: userObjectId });
    orClauses.push({ createdBy: userObjectId });
  }

  orClauses.push({
    status: 'published',
    visibility: 'organization',
  });

  if (groupIds.length) {
    orClauses.push({
      status: 'published',
      visibility: 'team',
      sharedWith: { $elemMatch: { type: 'team', id: { $in: groupIds } } },
    });
  }

  if (roleId) {
    orClauses.push({
      status: 'published',
      visibility: 'role',
      sharedWith: { $elemMatch: { type: 'role', id: String(roleId) } },
    });
  }

  if (userObjectId) {
    orClauses.push({
      status: 'published',
      sharedWith: { $elemMatch: { type: 'user', id: String(userObjectId) } },
    });
  }

  return {
    organizationId,
    $or: orClauses,
  };
}

function applyListedInHomeFilter(query, { includeHidden = false } = {}) {
  if (includeHidden) return query;
  return {
    ...query,
    $and: [
      ...(query.$and || []),
      {
        $or: [{ listedInHome: { $ne: false } }, { listedInHome: { $exists: false } }],
      },
    ],
  };
}

module.exports = {
  DEFAULT_REPORT_PERMISSIONS,
  normalizeReportPermissions,
  isReportOwner,
  userBypassesReportSharing,
  passesVisibility,
  canViewReport,
  canEditReport,
  canExportReport,
  canCloneReport,
  canShareReport,
  assertReportViewAccess,
  assertReportEditAccess,
  assertReportExportAccess,
  assertReportCloneAccess,
  buildReportListVisibilityFilter,
  applyListedInHomeFilter,
  buildReportAccessContext,
  passesPermissionLevel,
};
