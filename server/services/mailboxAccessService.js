/**
 * Shared access rules for mailboxes (threads, outbound, admin edits).
 */

function isTenantAdmin(user) {
  if (!user) return false;
  if (user.isOwner) return true;
  const r = String(user.role || '').toLowerCase();
  return r === 'admin' || r === 'platform_admin';
}

/**
 * Who may see threads scoped to this mailbox in workspace inbox / APIs.
 * - personal: owner only (never other users or admins)
 * - smtp_sender: owner only (send-only; not used for inbox threads)
 * - group: all org users if memberUserIds is empty; else listed members + admins
 */
function canUserAccessMailboxThreads(user, mailboxLean) {
  if (!mailboxLean || !user) return false;
  if (mailboxLean.kind === 'personal' || mailboxLean.kind === 'smtp_sender') {
    return String(mailboxLean.ownerUserId || '') === String(user._id);
  }
  if (isTenantAdmin(user)) return true;
  const members = mailboxLean.memberUserIds || [];
  if (!Array.isArray(members) || members.length === 0) {
    return true;
  }
  return members.some((id) => String(id) === String(user._id));
}

/**
 * Who may connect/disconnect Gmail and change sync labels on a mailbox.
 * - personal / smtp_sender: owner or tenant admin
 * - group: tenant admin only
 */
function canManageGmailInboxSync(user, mailboxLean) {
  if (!mailboxLean || !user) return false;
  if (mailboxLean.kind === 'personal' || mailboxLean.kind === 'smtp_sender') {
    if (isTenantAdmin(user)) return true;
    return String(mailboxLean.ownerUserId || '') === String(user._id);
  }
  if (mailboxLean.kind === 'group') {
    return isTenantAdmin(user);
  }
  return false;
}

/**
 * Who may trigger a manual Gmail sync run.
 * - personal: owner or admin
 * - group: admin or any user with thread access (members when restricted)
 */
function canRunGmailInboxSync(user, mailboxLean) {
  if (!mailboxLean || !user) return false;
  if (!canManageGmailInboxSync(user, mailboxLean)) {
    if (mailboxLean.kind === 'group' && canUserAccessMailboxThreads(user, mailboxLean)) {
      return true;
    }
    return false;
  }
  return true;
}

/**
 * @returns {string | null} Error message for API responses
 */
function assertGmailSyncManageAccess(mailboxLean, user) {
  if (!mailboxLean) return 'Mailbox not found';
  if (!canManageGmailInboxSync(user, mailboxLean)) {
    if (mailboxLean.kind === 'group') {
      return 'Only organization admins can connect Gmail for shared mailboxes';
    }
    if (mailboxLean.kind === 'smtp_sender') {
      return 'Only the owner can manage this SMTP sender';
    }
    return 'Only the mailbox owner can manage Gmail inbox sync';
  }
  return null;
}

/**
 * @returns {string | null} Error message for API responses
 */
function assertGmailSyncRunAccess(mailboxLean, user) {
  if (!mailboxLean) return 'Mailbox not found';
  if (!canRunGmailInboxSync(user, mailboxLean)) {
    return 'You do not have access to sync this mailbox';
  }
  return null;
}

/**
 * Mailbox ids the user may see threads for (personal owner, group membership, or admin for group only).
 * @param {object} user
 * @param {import('mongoose').Types.ObjectId | string} organizationId
 * @param {object[]} [mailboxesLean] — optional preloaded mailboxes for the org
 * @returns {Promise<import('mongoose').Types.ObjectId[]>}
 */
async function getAccessibleMailboxIds(user, organizationId, mailboxesLean) {
  const Mailbox = require('../models/Mailbox');
  const rows =
    Array.isArray(mailboxesLean) && mailboxesLean.length > 0
      ? mailboxesLean
      : await Mailbox.find({ organizationId }).select('kind ownerUserId memberUserIds').lean();
  return rows
    .filter((mb) => mb.kind !== 'smtp_sender' && canUserAccessMailboxThreads(user, mb))
    .map((mb) => mb._id);
}

module.exports = {
  isTenantAdmin,
  canUserAccessMailboxThreads,
  canManageGmailInboxSync,
  canRunGmailInboxSync,
  assertGmailSyncManageAccess,
  assertGmailSyncRunAccess,
  getAccessibleMailboxIds
};
