const Group = require('../models/Group');

function buildDocumentVisibilityConditions({ userId, userRoleId, userGroupIds = [] }) {
  const conditions = [
    { 'visibility.private': { $ne: true } },
    { 'visibility.private': { $exists: false } },
    { assignedTo: userId },
    { createdBy: userId }
  ];

  if (userRoleId) {
    conditions.push({ 'visibility.roleIds': userRoleId });
  }

  const groupIds = (userGroupIds || []).filter(Boolean);
  if (groupIds.length) {
    conditions.push({ 'visibility.teamIds': { $in: groupIds } });
  }

  return conditions;
}

async function getUserGroupIds(organizationId, userId) {
  if (!organizationId || !userId) return [];
  const groups = await Group.find({ organizationId, members: userId })
    .select('_id')
    .lean();
  return groups.map((group) => group._id).filter(Boolean);
}

function applyDocumentVisibilityFilter(query, { hasViewAll, userId, userRoleId, userGroupIds }) {
  if (hasViewAll) return query;

  const visibilityClause = { $or: buildDocumentVisibilityConditions({ userId, userRoleId, userGroupIds }) };
  if (query.$and) {
    query.$and.push(visibilityClause);
    return query;
  }
  if (query.$or) {
    query.$and = [{ $or: query.$or }, visibilityClause];
    delete query.$or;
    return query;
  }

  query.$and = [visibilityClause];
  return query;
}

function userCanAccessDocument(doc, { hasViewAll, userId, userRoleId, userGroupIds = [] }) {
  if (hasViewAll || !doc) return true;
  const visibility = doc.visibility || {};
  if (!visibility.private) return true;

  const uid = String(userId || '');
  if (uid && (String(doc.assignedTo || '') === uid || String(doc.createdBy || '') === uid)) {
    return true;
  }

  const roleId = userRoleId ? String(userRoleId) : '';
  if (roleId && Array.isArray(visibility.roleIds)) {
    if (visibility.roleIds.some((id) => String(id) === roleId)) return true;
  }

  const groupSet = new Set((userGroupIds || []).map(String));
  if (groupSet.size && Array.isArray(visibility.teamIds)) {
    if (visibility.teamIds.some((id) => groupSet.has(String(id)))) return true;
  }

  return false;
}

module.exports = {
  buildDocumentVisibilityConditions,
  getUserGroupIds,
  applyDocumentVisibilityFilter,
  userCanAccessDocument
};
