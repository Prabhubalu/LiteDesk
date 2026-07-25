'use strict';

/**
 * Resolve canvas access role for a user.
 * @returns {'owner'|'editor'|'viewer'|null}
 */
function resolveCanvasRole(canvas, userId) {
  if (!canvas || !userId) return null;
  const uid = String(userId);
  const perms = canvas.permissions || {};
  if (String(perms.ownerId) === uid) return 'owner';
  const editors = (perms.editorIds || []).map(String);
  if (editors.includes(uid)) return 'editor';
  const viewers = (perms.viewerIds || []).map(String);
  if (viewers.includes(uid)) return 'viewer';
  return null;
}

function canViewCanvas(canvas, userId, { linkToken } = {}) {
  const role = resolveCanvasRole(canvas, userId);
  if (role) return true;
  const link = canvas?.permissions?.linkShare;
  if (link?.enabled && linkToken && link.token && link.token === linkToken) {
    return true;
  }
  return false;
}

function canEditCanvas(canvas, userId) {
  const role = resolveCanvasRole(canvas, userId);
  return role === 'owner' || role === 'editor';
}

function canManageCanvas(canvas, userId) {
  return resolveCanvasRole(canvas, userId) === 'owner';
}

function linkShareRole(canvas, linkToken) {
  const link = canvas?.permissions?.linkShare;
  if (!link?.enabled || !linkToken || link.token !== linkToken) return null;
  return link.role === 'editor' ? 'editor' : 'viewer';
}

module.exports = {
  resolveCanvasRole,
  canViewCanvas,
  canEditCanvas,
  canManageCanvas,
  linkShareRole,
};
