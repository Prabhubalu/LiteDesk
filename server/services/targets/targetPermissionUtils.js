'use strict';

function hasTargetPermission(user, action) {
  if (!user) return false;
  if (user.isOwner) return true;
  if (String(user.role || '').toLowerCase() === 'admin') return true;

  const perf = user.permissions?.performance?.targets || {};
  const settingsEdit = user.permissions?.settings?.edit;

  switch (action) {
    case 'view':
      return Boolean(perf.view || perf.create || perf.edit || settingsEdit);
    case 'create':
      return Boolean(perf.create || perf.edit || settingsEdit);
    case 'edit':
      return Boolean(perf.edit || settingsEdit);
    case 'activate':
      return Boolean(perf.activate || perf.edit || settingsEdit);
    case 'manageTypes':
      return Boolean(perf.manageTypes || settingsEdit);
    case 'manageOrgSettings':
      return Boolean(perf.manageOrgSettings || settingsEdit);
    default:
      return false;
  }
}

function assertTargetPermission(user, action) {
  if (!hasTargetPermission(user, action)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
}

module.exports = {
  hasTargetPermission,
  assertTargetPermission
};
