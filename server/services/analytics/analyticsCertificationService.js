const { isTenantPrivilegedUser } = require('../../utils/tenantPrivilegedAccess');
const {
  ANALYTICS_MODULE_KEYS,
  hasAnalyticsPermission,
} = require('../../permissions/analyticsPermissions');

function userPermissionsPlain(user) {
  const p = user?.permissions;
  if (!p) return {};
  return typeof p.toObject === 'function' ? p.toObject() : { ...p };
}

function canCertifyAnalyticsAssets(user) {
  if (!user) return false;
  if (user.isOwner || isTenantPrivilegedUser(user)) return true;
  return hasAnalyticsPermission(userPermissionsPlain(user), ANALYTICS_MODULE_KEYS.ADMIN, 'certify');
}

function canEditCertifiedAsset(user, asset) {
  if (!asset?.certified) return true;
  if (!user) return false;
  if (user.isOwner || isTenantPrivilegedUser(user)) return true;
  if (canCertifyAnalyticsAssets(user)) return true;
  const ownerId = asset.ownerId?._id || asset.ownerId;
  return ownerId && String(ownerId) === String(user._id);
}

function assertCanEditCertifiedAsset(user, asset) {
  if (canEditCertifiedAsset(user, asset)) return;
  const err = new Error('Certified assets can only be edited by the owner or analytics admin');
  err.statusCode = 403;
  err.code = 'CERTIFIED_ASSET_LOCKED';
  throw err;
}

module.exports = {
  canCertifyAnalyticsAssets,
  canEditCertifiedAsset,
  assertCanEditCertifiedAsset,
};
