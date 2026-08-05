/**
 * Canonical resolution of outbound From / send mailbox for agent + workspace email.
 * Used by compose-preview and sendEmail so UI and delivery never diverge.
 */

const mongoose = require('mongoose');
const Mailbox = require('../../../models/Mailbox');
const User = require('../../../models/User');
const { canUserAccessMailboxThreads } = require('../../../services/mailboxAccessService');
const {
  isGmailMailboxReady
} = require('../../../services/mailboxGmailInboxSyncService');
const {
  isMailboxGmailSmtpReady
} = require('../../../services/mailboxGmailSmtpService');

function resolveMailboxFromAddress(mailboxLean) {
  const addr = String(mailboxLean?.emailAddress || mailboxLean?.inboxSyncAccountEmail || '')
    .trim()
    .toLowerCase();
  return addr || null;
}

function isMailboxSendable(mb) {
  if (!mb) return false;
  return isGmailMailboxReady(mb) || isMailboxGmailSmtpReady(mb);
}

function toMailboxIdentity(mb) {
  const emailAddress = resolveMailboxFromAddress(mb);
  if (!emailAddress) return null;
  const viaApi = isGmailMailboxReady(mb);
  return {
    id: `mailbox:${String(mb._id)}`,
    mailboxId: String(mb._id),
    emailAddress,
    label: String(mb.label || '').trim() || emailAddress,
    source: 'mailbox',
    kind: mb.kind === 'group' ? 'group' : 'personal',
    viaSmtp: !viaApi && isMailboxGmailSmtpReady(mb)
  };
}

/**
 * All send-capable mailboxes the user may use (personal first, then group).
 * @returns {Promise<object[]>}
 */
async function listSendableMailboxDocs(organizationId, user) {
  if (!organizationId || !user) return [];

  const candidates = await Mailbox.find({
    organizationId,
    $or: [
      { kind: 'personal', ownerUserId: user._id },
      { kind: 'group' }
    ]
  }).lean();

  const personal = [];
  const group = [];
  for (const mb of candidates) {
    if (!canUserAccessMailboxThreads(user, mb) || !isMailboxSendable(mb)) continue;
    if (!resolveMailboxFromAddress(mb)) continue;
    if (mb.kind === 'personal') personal.push(mb);
    else group.push(mb);
  }
  return [...personal, ...group];
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {object} user — req.user
 * @returns {Promise<object[]>} identity DTOs for compose picker
 */
async function listSendableIdentities(organizationId, user) {
  const docs = await listSendableMailboxDocs(organizationId, user);
  return docs.map(toMailboxIdentity).filter(Boolean);
}

async function loadUserDefaultMailboxId(userId) {
  if (!userId) return null;
  const doc = await User.findById(userId).select('defaultOutboundMailboxId').lean();
  const raw = doc?.defaultOutboundMailboxId;
  if (!raw || !mongoose.Types.ObjectId.isValid(String(raw))) return null;
  return String(raw);
}

/**
 * Resolve From + mailbox for preview / send.
 *
 * Priority:
 * 1. explicit mailboxId (ACL + sendable)
 * 2. user.defaultOutboundMailboxId if still sendable
 * 3. first sendable personal, then group
 * 4. tenant Integrations From
 * 5. user login email
 *
 * @param {object} opts
 * @param {import('mongoose').Types.ObjectId|string} opts.organizationId
 * @param {object} opts.user
 * @param {string} [opts.mailboxId]
 * @param {string} [opts.moduleKey]
 * @returns {Promise<{
 *   fromEmail: string,
 *   fromName: string,
 *   fromSource: 'mailbox'|'tenant_config'|'user',
 *   mailboxId: string|null,
 *   identities: object[],
 *   defaultOutboundMailboxId: string|null
 * }>}
 */
async function resolveOutboundIdentity({ organizationId, user, mailboxId } = {}) {
  const mailboxes = await listSendableMailboxDocs(organizationId, user);
  const identities = mailboxes.map(toMailboxIdentity).filter(Boolean);
  const byId = new Map(mailboxes.map((m) => [String(m._id), m]));

  const defaultOutboundMailboxId = await loadUserDefaultMailboxId(user?._id);

  const applyMailbox = (mb) => {
    const identity = toMailboxIdentity(mb);
    if (!identity) return null;
    return {
      fromEmail: identity.emailAddress,
      fromName: identity.label !== identity.emailAddress ? String(mb.label || '').trim() : '',
      fromSource: 'mailbox',
      mailboxId: String(mb._id),
      identities,
      defaultOutboundMailboxId
    };
  };

  const explicitId = String(mailboxId || '').trim();
  if (explicitId && mongoose.Types.ObjectId.isValid(explicitId)) {
    const mb = byId.get(explicitId);
    if (mb) {
      const applied = applyMailbox(mb);
      if (applied) return applied;
    }
    // Not in sendable list — still allow access check for clearer errors at send time
    const full = await Mailbox.findOne({ _id: explicitId, organizationId }).lean();
    if (full && canUserAccessMailboxThreads(user, full) && isMailboxSendable(full)) {
      const applied = applyMailbox(full);
      if (applied) return applied;
    }
  }

  if (defaultOutboundMailboxId && byId.has(defaultOutboundMailboxId)) {
    const applied = applyMailbox(byId.get(defaultOutboundMailboxId));
    if (applied) return applied;
  }

  if (mailboxes.length) {
    const applied = applyMailbox(mailboxes[0]);
    if (applied) return applied;
  }

  let fromEmail = String(user?.email || process.env.EMAIL_FROM || '').trim();
  let fromName = '';
  let fromSource = 'user';

  try {
    const emailService = require('../../../services/emailService');
    const orgCfg = await emailService.getOrganizationEmailConfig(organizationId);
    const tenantFrom = String(orgCfg?.fromEmail || '').trim();
    if (tenantFrom) {
      fromEmail = tenantFrom;
      fromName = String(orgCfg?.fromName || '').trim();
      fromSource = 'tenant_config';
    }
  } catch {
    /* keep user fallback */
  }

  // Surface org SMTP as pickable identity when no mailboxes
  if (fromSource === 'tenant_config' && fromEmail) {
    identities.push({
      id: 'tenant_config',
      mailboxId: null,
      emailAddress: fromEmail.toLowerCase(),
      label: fromName || fromEmail,
      source: 'tenant_config',
      kind: null,
      viaSmtp: false
    });
  }

  return {
    fromEmail,
    fromName,
    fromSource,
    mailboxId: null,
    identities,
    defaultOutboundMailboxId
  };
}

/**
 * Persist user default send mailbox (null clears).
 */
async function setDefaultOutboundMailbox({ organizationId, userId, mailboxId }) {
  if (!userId || !organizationId) {
    return { ok: false, status: 400, message: 'Missing user or organization' };
  }

  if (mailboxId == null || String(mailboxId).trim() === '') {
    await User.updateOne(
      { _id: userId, organizationId },
      { $set: { defaultOutboundMailboxId: null } }
    );
    return { ok: true, defaultOutboundMailboxId: null };
  }

  const id = String(mailboxId).trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { ok: false, status: 400, message: 'Invalid mailboxId' };
  }

  const user = await User.findOne({ _id: userId, organizationId }).select('_id role isOwner').lean();
  if (!user) {
    return { ok: false, status: 404, message: 'User not found' };
  }

  const mb = await Mailbox.findOne({ _id: id, organizationId }).lean();
  if (!mb) {
    return { ok: false, status: 404, message: 'Mailbox not found' };
  }
  if (!canUserAccessMailboxThreads(user, mb) || !isMailboxSendable(mb)) {
    return { ok: false, status: 403, message: 'Mailbox is not available for sending' };
  }

  await User.updateOne(
    { _id: userId, organizationId },
    { $set: { defaultOutboundMailboxId: mb._id } }
  );

  return { ok: true, defaultOutboundMailboxId: String(mb._id) };
}

module.exports = {
  resolveMailboxFromAddress,
  isMailboxSendable,
  listSendableMailboxDocs,
  listSendableIdentities,
  resolveOutboundIdentity,
  setDefaultOutboundMailbox,
  loadUserDefaultMailboxId
};
