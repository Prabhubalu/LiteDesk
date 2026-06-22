const { isTenantPrivilegedUser } = require('./tenantPrivilegedAccess');

function getLiveChatPermissions(user) {
  const perms = user?.permissions?.liveChat;
  return perms && typeof perms === 'object' ? perms : null;
}

function canViewLiveChatSessions(user) {
  if (!user) return false;
  if (user.isOwner || isTenantPrivilegedUser(user)) return true;
  const perms = getLiveChatPermissions(user);
  if (!perms) return true;
  return perms.view === true || perms.sessions?.view === true;
}

function canReplyLiveChatSessions(user) {
  if (!user) return false;
  if (user.isOwner || isTenantPrivilegedUser(user)) return true;
  const perms = getLiveChatPermissions(user);
  if (!perms) return true;
  if (perms.reply === true || perms.sessions?.reply === true) return true;
  // MVP: session viewers may reply unless view is also denied.
  return canViewLiveChatSessions(user);
}

function canAdminLiveChat(user) {
  if (!user) return false;
  if (user.isOwner || isTenantPrivilegedUser(user)) return true;
  const perms = getLiveChatPermissions(user);
  if (!perms) return false;
  return perms.admin === true;
}

module.exports = {
  canViewLiveChatSessions,
  canReplyLiveChatSessions,
  canAdminLiveChat,
};
