const { isTenantPrivilegedUser } = require('./tenantPrivilegedAccess');

function getAnnouncementPermissions(user) {
  const perms = user?.permissions?.announcements;
  return perms && typeof perms === 'object' ? perms : null;
}

function isPrivileged(user) {
  if (!user) return false;
  return user.isOwner === true || isTenantPrivilegedUser(user);
}

function canViewAnnouncements(user) {
  if (!user) return false;
  if (isPrivileged(user)) return true;
  const perms = getAnnouncementPermissions(user);
  if (!perms) return false;
  return perms.view === true || perms.manage === true || perms.publish === true;
}

function canManageAnnouncements(user) {
  if (!user) return false;
  if (isPrivileged(user)) return true;
  const perms = getAnnouncementPermissions(user);
  return perms?.manage === true;
}

function canPublishAnnouncements(user) {
  if (!user) return false;
  if (isPrivileged(user)) return true;
  const perms = getAnnouncementPermissions(user);
  return perms?.publish === true;
}

function canViewAnnouncementAnalytics(user) {
  if (!user) return false;
  if (isPrivileged(user)) return true;
  const perms = getAnnouncementPermissions(user);
  return perms?.analytics === true || perms?.publish === true;
}

module.exports = {
  canViewAnnouncements,
  canManageAnnouncements,
  canPublishAnnouncements,
  canViewAnnouncementAnalytics,
};
