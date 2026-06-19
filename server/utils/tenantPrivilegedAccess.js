/**
 * Tenant-scoped privileged users (Owner / Admin) receive full module access
 * within their organization. Org-level guards (enabled apps, trial, etc.) still apply.
 */

function normalizeRoleName(user) {
  return String(user?.role || '').trim().toLowerCase();
}

function isPrivilegedSystemRoleName(roleName) {
  const name = String(roleName || '').trim();
  return name === 'Owner' || name === 'Admin' || name === 'Administrator';
}

function isPrivilegedSystemRole(roleLean) {
  if (!roleLean?.isSystemRole) return false;
  return isPrivilegedSystemRoleName(roleLean.name);
}

function isTenantPrivilegedUser(user) {
  if (!user) return false;
  if (user.isOwner === true) return true;
  if (user._isTenantPrivileged === true) return true;
  const role = normalizeRoleName(user);
  return role === 'owner' || role === 'admin' || role === 'administrator';
}

module.exports = {
  isPrivilegedSystemRole,
  isPrivilegedSystemRoleName,
  isTenantPrivilegedUser
};
