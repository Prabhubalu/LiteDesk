/**
 * Canonical resolution of outbound From / send mailbox for agent + workspace email.
 * Used by compose-preview and sendEmail so UI and delivery never diverge.
 *
 * Delivery modes:
 * - mailbox_smtp — consumer (or any) From with mailbox SMTP/OAuth ready
 * - org_provider — custom domain From via org AMDS/Resend/SES/SMTP
 * - needs_smtp_setup — consumer From without mailbox SMTP
 * - needs_org_domain — org-domain From but org provider not ready
 */

const mongoose = require('mongoose');
const Mailbox = require('../../../models/Mailbox');
const User = require('../../../models/User');
const { canUserAccessMailboxThreads } = require('../../../services/mailboxAccessService');
const {
  isGmailMailboxReady
} = require('../../../services/mailboxGmailInboxSyncService');
const {
  isMailboxSmtpReady,
  isConsumerDomain,
  extractEmailDomain
} = require('../../../services/mailboxSmtpService');

const DELIVERY_MODES = Object.freeze({
  MAILBOX_SMTP: 'mailbox_smtp',
  ORG_PROVIDER: 'org_provider',
  NEEDS_SMTP_SETUP: 'needs_smtp_setup',
  NEEDS_ORG_DOMAIN: 'needs_org_domain'
});

function resolveMailboxFromAddress(mailboxLean) {
  const addr = String(mailboxLean?.emailAddress || mailboxLean?.inboxSyncAccountEmail || '')
    .trim()
    .toLowerCase();
  return addr || null;
}

function isMailboxSendable(mb) {
  if (!mb) return false;
  return isGmailMailboxReady(mb) || isMailboxSmtpReady(mb);
}

/** Display address for From picker: team email, then Gmail account, then parser routing. */
function resolveMailboxDisplayAddress(mailboxLean) {
  return (
    resolveMailboxFromAddress(mailboxLean)
    || String(mailboxLean?.routingAddress || '').trim().toLowerCase()
    || null
  );
}

/**
 * @param {string} email
 * @param {{ mailboxReady?: boolean, orgConfigured?: boolean, orgFromDomain?: string }} ctx
 */
function resolveDeliveryMode(email, ctx = {}) {
  const addr = String(email || '').trim().toLowerCase();
  if (!addr || !addr.includes('@')) {
    return DELIVERY_MODES.NEEDS_ORG_DOMAIN;
  }

  if (isConsumerDomain(addr)) {
    return ctx.mailboxReady
      ? DELIVERY_MODES.MAILBOX_SMTP
      : DELIVERY_MODES.NEEDS_SMTP_SETUP;
  }

  // Custom / org domain
  if (ctx.mailboxReady) {
    // Connected mailbox can always send as itself via SMTP/OAuth
    return DELIVERY_MODES.MAILBOX_SMTP;
  }

  if (ctx.orgConfigured) {
    const fromDomain = extractEmailDomain(addr);
    const orgDomain = String(ctx.orgFromDomain || '').trim().toLowerCase();
    // Prefer org provider when From domain matches configured From, or org has any From set
    if (!orgDomain || fromDomain === orgDomain) {
      return DELIVERY_MODES.ORG_PROVIDER;
    }
    // Different custom domain than org From — still attempt org provider (AMDS may allow multiple domains)
    return DELIVERY_MODES.ORG_PROVIDER;
  }

  return DELIVERY_MODES.NEEDS_ORG_DOMAIN;
}

function toMailboxIdentity(mb, orgCtx = {}) {
  const emailAddress = resolveMailboxDisplayAddress(mb);
  if (!emailAddress) return null;
  const viaApi = isGmailMailboxReady(mb);
  const viaSmtp = !viaApi && isMailboxSmtpReady(mb);
  const mailboxReady = viaApi || viaSmtp;
  const deliveryMode = resolveDeliveryMode(emailAddress, {
    mailboxReady,
    orgConfigured: orgCtx.orgConfigured,
    orgFromDomain: orgCtx.orgFromDomain
  });
  const smtpFromName = String(
    mb.smtpOutboundFromName || (viaSmtp ? mb.label : '') || ''
  ).trim();
  const groupLabel =
    mb.kind === 'group' && String(mb.label || '').trim() && String(mb.label || '').trim() !== emailAddress
      ? String(mb.label || '').trim()
      : '';
  const fromName =
    viaSmtp && smtpFromName && smtpFromName.toLowerCase() !== emailAddress
      ? smtpFromName
      : groupLabel;
  return {
    id: `mailbox:${String(mb._id)}`,
    mailboxId: String(mb._id),
    emailAddress,
    label: String(mb.label || '').trim() || emailAddress,
    fromName,
    source: 'mailbox',
    kind: mb.kind === 'group' ? 'group' : mb.kind === 'smtp_sender' ? 'smtp_sender' : 'personal',
    viaSmtp,
    viaApi,
    viaPlatformSmtp: !viaApi && !viaSmtp && deliveryMode === DELIVERY_MODES.ORG_PROVIDER,
    deliveryMode,
    isConsumer: isConsumerDomain(emailAddress)
  };
}

/**
 * Accessible mailboxes the user may pick as From (personal, smtp_sender, then group).
 */
async function listOutboundMailboxDocs(organizationId, user) {
  if (!organizationId || !user) return [];

  const candidates = await Mailbox.find({
    organizationId,
    $or: [
      { kind: 'personal', ownerUserId: user._id },
      { kind: 'smtp_sender', ownerUserId: user._id },
      { kind: 'group' }
    ]
  }).lean();

  const personal = [];
  const smtpSenders = [];
  const group = [];
  for (const mb of candidates) {
    if (!canUserAccessMailboxThreads(user, mb)) continue;
    if (!resolveMailboxDisplayAddress(mb)) continue;
    if (mb.kind === 'personal') personal.push(mb);
    else if (mb.kind === 'smtp_sender') smtpSenders.push(mb);
    else group.push(mb);
  }
  return [...personal, ...smtpSenders, ...group];
}

/** @deprecated Prefer listOutboundMailboxDocs — kept for Gmail-only helpers. */
async function listSendableMailboxDocs(organizationId, user) {
  const all = await listOutboundMailboxDocs(organizationId, user);
  return all.filter((mb) => isMailboxSendable(mb));
}

async function loadOrgEmailContext(organizationId) {
  try {
    const emailService = require('../../../services/emailService');
    const orgCfg = await emailService.getOrganizationEmailConfig(organizationId);
    const fromEmail = String(orgCfg?.fromEmail || '').trim().toLowerCase();
    const configured = await emailService.isConfiguredForOrganization(organizationId);
    return {
      fromEmail,
      fromName: String(orgCfg?.fromName || '').trim(),
      orgConfigured: Boolean(configured && fromEmail),
      orgFromDomain: extractEmailDomain(fromEmail)
    };
  } catch {
    return { fromEmail: '', fromName: '', orgConfigured: false, orgFromDomain: '' };
  }
}

async function loadTenantFromIdentity(organizationId, orgCtx) {
  const ctx = orgCtx || (await loadOrgEmailContext(organizationId));
  if (!ctx.fromEmail) return null;
  const deliveryMode = resolveDeliveryMode(ctx.fromEmail, {
    mailboxReady: false,
    orgConfigured: ctx.orgConfigured,
    orgFromDomain: ctx.orgFromDomain
  });
  const fromName = String(ctx.fromName || '').trim();
  return {
    id: 'tenant_config',
    mailboxId: null,
    emailAddress: ctx.fromEmail,
    label: fromName || ctx.fromEmail,
    fromName,
    source: 'tenant_config',
    kind: null,
    viaSmtp: false,
    viaApi: false,
    viaPlatformSmtp: deliveryMode === DELIVERY_MODES.ORG_PROVIDER,
    deliveryMode,
    isConsumer: isConsumerDomain(ctx.fromEmail)
  };
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {object} user — req.user
 * @returns {Promise<object[]>} identity DTOs for compose picker
 */
async function listSendableIdentities(organizationId, user) {
  const orgCtx = await loadOrgEmailContext(organizationId);
  const docs = await listOutboundMailboxDocs(organizationId, user);
  const identities = docs.map((mb) => toMailboxIdentity(mb, orgCtx)).filter(Boolean);
  const tenant = await loadTenantFromIdentity(organizationId, orgCtx);
  if (tenant && !identities.some((i) => i.id === 'tenant_config')) {
    identities.push(tenant);
  }
  return identities;
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
 * 1. explicit fromSource tenant_config | user (ignores mailbox defaults)
 * 2. explicit mailboxId (ACL + listed in picker)
 * 3. user.defaultOutboundMailboxId if still accessible
 * 4. org Email Provider From when ready and no SMTP/OAuth-ready mailbox
 * 5. first SMTP/OAuth-ready mailbox
 * 6. tenant From (any)
 * 7. first mailbox (may need SMTP setup)
 * 8. user login email
 */
async function resolveOutboundIdentity({ organizationId, user, mailboxId, fromSource } = {}) {
  const orgCtx = await loadOrgEmailContext(organizationId);
  const mailboxes = await listOutboundMailboxDocs(organizationId, user);
  const identities = mailboxes.map((mb) => toMailboxIdentity(mb, orgCtx)).filter(Boolean);
  const byId = new Map(mailboxes.map((m) => [String(m._id), m]));

  const tenantIdentity = await loadTenantFromIdentity(organizationId, orgCtx);
  if (tenantIdentity && !identities.some((i) => i.id === 'tenant_config')) {
    identities.push(tenantIdentity);
  }

  const defaultOutboundMailboxId = await loadUserDefaultMailboxId(user?._id);

  const applyMailbox = (mb) => {
    const identity = toMailboxIdentity(mb, orgCtx);
    if (!identity) return null;
    return {
      fromEmail: identity.emailAddress,
      fromName: identity.fromName || '',
      fromSource: 'mailbox',
      mailboxId: String(mb._id),
      deliveryMode: identity.deliveryMode,
      identities,
      defaultOutboundMailboxId
    };
  };

  const applyTenant = () => {
    if (!tenantIdentity) return null;
    return {
      fromEmail: tenantIdentity.emailAddress,
      fromName: String(tenantIdentity.fromName || '').trim(),
      fromSource: 'tenant_config',
      mailboxId: null,
      deliveryMode: tenantIdentity.deliveryMode,
      identities,
      defaultOutboundMailboxId
    };
  };

  const requestedSource = String(fromSource || '').trim().toLowerCase();
  if (requestedSource === 'tenant_config') {
    const applied = applyTenant();
    if (applied) return applied;
  }
  if (requestedSource === 'user') {
    const fromEmail = String(user?.email || process.env.EMAIL_FROM || '').trim();
    return {
      fromEmail,
      fromName: '',
      fromSource: 'user',
      mailboxId: null,
      deliveryMode: resolveDeliveryMode(fromEmail, {
        mailboxReady: false,
        orgConfigured: orgCtx.orgConfigured,
        orgFromDomain: orgCtx.orgFromDomain
      }),
      identities,
      defaultOutboundMailboxId
    };
  }

  const explicitId = String(mailboxId || '').trim();
  if (explicitId && mongoose.Types.ObjectId.isValid(explicitId)) {
    const mb = byId.get(explicitId);
    if (mb) {
      const applied = applyMailbox(mb);
      if (applied) return applied;
    }
    const full = await Mailbox.findOne({ _id: explicitId, organizationId }).lean();
    if (full && canUserAccessMailboxThreads(user, full) && toMailboxIdentity(full, orgCtx)) {
      const applied = applyMailbox(full);
      if (applied) {
        if (!identities.some((i) => i.mailboxId === String(full._id))) {
          const idty = toMailboxIdentity(full, orgCtx);
          if (idty) identities.unshift(idty);
        }
        return applied;
      }
    }
  }

  // Explicit org From request already handled; do not fall through to mailbox defaults
  // when caller cleared mailboxId for tenant_config (fromSource handled above).

  if (defaultOutboundMailboxId && byId.has(defaultOutboundMailboxId)) {
    const applied = applyMailbox(byId.get(defaultOutboundMailboxId));
    if (applied) return applied;
  }

  // Prefer org Email Provider From when ready and no mailbox is SMTP/OAuth-ready.
  const readyMailbox = mailboxes.find((mb) => {
    const idty = toMailboxIdentity(mb, orgCtx);
    return idty && idty.deliveryMode === DELIVERY_MODES.MAILBOX_SMTP;
  });

  if (
    tenantIdentity
    && tenantIdentity.deliveryMode === DELIVERY_MODES.ORG_PROVIDER
    && !readyMailbox
  ) {
    const applied = applyTenant();
    if (applied) return applied;
  }

  if (readyMailbox) {
    const applied = applyMailbox(readyMailbox);
    if (applied) return applied;
  }

  {
    const applied = applyTenant();
    if (applied) return applied;
  }

  if (mailboxes.length) {
    const applied = applyMailbox(mailboxes[0]);
    if (applied) return applied;
  }

  const fromEmail = String(user?.email || process.env.EMAIL_FROM || '').trim();
  const deliveryMode = resolveDeliveryMode(fromEmail, {
    mailboxReady: false,
    orgConfigured: orgCtx.orgConfigured,
    orgFromDomain: orgCtx.orgFromDomain
  });
  return {
    fromEmail,
    fromName: '',
    fromSource: 'user',
    mailboxId: null,
    deliveryMode,
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
  if (!canUserAccessMailboxThreads(user, mb) || !resolveMailboxDisplayAddress(mb)) {
    return { ok: false, status: 403, message: 'Mailbox is not available for sending' };
  }

  await User.updateOne(
    { _id: userId, organizationId },
    { $set: { defaultOutboundMailboxId: mb._id } }
  );

  return { ok: true, defaultOutboundMailboxId: String(mb._id) };
}

module.exports = {
  DELIVERY_MODES,
  resolveMailboxFromAddress,
  resolveDeliveryMode,
  isMailboxSendable,
  listSendableMailboxDocs,
  listOutboundMailboxDocs,
  listSendableIdentities,
  resolveOutboundIdentity,
  setDefaultOutboundMailbox,
  loadUserDefaultMailboxId
};
