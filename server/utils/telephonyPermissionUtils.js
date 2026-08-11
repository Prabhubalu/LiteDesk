'use strict';

const { isTenantPrivilegedUser } = require('./tenantPrivilegedAccess');

function getTelephonyPermissions(user) {
  const perms = user?.permissions?.telephony;
  return perms && typeof perms === 'object' ? perms : null;
}

function canViewTelephony(user) {
  if (!user) return false;
  if (user.isOwner || isTenantPrivilegedUser(user)) return true;
  const perms = getTelephonyPermissions(user);
  if (!perms) return true;
  return perms.view === true;
}

function canPlaceTelephonyCalls(user) {
  if (!user) return false;
  if (user.isOwner || isTenantPrivilegedUser(user)) return true;
  const perms = getTelephonyPermissions(user);
  if (!perms) return canViewTelephony(user);
  return perms.call === true || canViewTelephony(user);
}

function canListenTelephonyRecordings(user) {
  if (!user) return false;
  if (user.isOwner || isTenantPrivilegedUser(user)) return true;
  const perms = getTelephonyPermissions(user);
  if (!perms) return false;
  return perms.listen === true || perms.admin === true;
}

function canDownloadTelephonyRecordings(user) {
  if (!user) return false;
  if (user.isOwner || isTenantPrivilegedUser(user)) return true;
  const perms = getTelephonyPermissions(user);
  if (!perms) return false;
  return perms.download === true || perms.admin === true;
}

function canManageTelephony(user) {
  if (!user) return false;
  if (user.isOwner || isTenantPrivilegedUser(user)) return true;
  const perms = getTelephonyPermissions(user);
  if (!perms) return false;
  return perms.manage === true || perms.admin === true;
}

function canAdminTelephony(user) {
  if (!user) return false;
  if (user.isOwner || isTenantPrivilegedUser(user)) return true;
  const perms = getTelephonyPermissions(user);
  if (!perms) return false;
  return perms.admin === true;
}

function canAccessTelephonyAi(user) {
  if (!user) return false;
  if (user.isOwner || isTenantPrivilegedUser(user)) return true;
  const perms = getTelephonyPermissions(user);
  if (!perms) return false;
  return perms.ai === true || perms.admin === true;
}

module.exports = {
  getTelephonyPermissions,
  canViewTelephony,
  canPlaceTelephonyCalls,
  canListenTelephonyRecordings,
  canDownloadTelephonyRecordings,
  canManageTelephony,
  canAdminTelephony,
  canAccessTelephonyAi,
};
