function isTenantPrivilegedUser(user) {
  if (!user) return false;
  if (user.isOwner === true) return true;
  const role = String(user.role || '').trim().toLowerCase();
  return role === 'owner' || role === 'admin' || role === 'administrator';
}

function getLiveChatPermissions(user) {
  const perms = user?.permissions?.liveChat;
  return perms && typeof perms === 'object' ? perms : null;
}

export function canViewLiveChatSessions(user) {
  if (!user) return false;
  if (isTenantPrivilegedUser(user)) return true;
  const perms = getLiveChatPermissions(user);
  if (!perms) return true;
  return perms.view === true || perms.sessions?.view === true;
}

export function canReplyLiveChatSessions(user) {
  if (!user) return false;
  if (isTenantPrivilegedUser(user)) return true;
  const perms = getLiveChatPermissions(user);
  if (!perms) return true;
  if (perms.reply === true || perms.sessions?.reply === true) return true;
  return canViewLiveChatSessions(user);
}

export function canAdminLiveChat(user) {
  if (!user) return false;
  if (isTenantPrivilegedUser(user)) return true;
  const perms = getLiveChatPermissions(user);
  if (!perms) return false;
  return perms.admin === true;
}

export function canTransferLiveChatSession(user, session) {
  if (!canReplyLiveChatSessions(user) || !session) return false;
  if (canAdminLiveChat(user)) return Boolean(session.assignedAgentId);
  const assignedId = session.assignedAgentId ? String(session.assignedAgentId) : '';
  return assignedId && assignedId === String(user._id || '');
}
