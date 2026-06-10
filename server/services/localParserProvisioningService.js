'use strict';

const Mailbox = require('../models/Mailbox');
const ParserMailboxRegistry = require('../models/ParserMailboxRegistry');
const {
  resolveParserIdsForMailbox,
  routingLocalPartFromMailbox
} = require('../utils/parserIdCodec');
const { runWithOrganizationTenantContext } = require('../utils/organizationTenantContext');

const LOCAL_ROUTING_DOMAIN = String(process.env.LOCAL_PARSER_ROUTING_DOMAIN || 'inbound.local.test')
  .trim()
  .toLowerCase();

function buildLocalRoutingAddress(mailbox, parserMailboxId) {
  const localPart = routingLocalPartFromMailbox({
    label: mailbox.label,
    emailAddress: mailbox.emailAddress,
    kind: mailbox.kind,
    ownerUserId: mailbox.ownerUserId,
    mailboxObjectId: mailbox._id
  });
  return `${localPart}+${parserMailboxId}@${LOCAL_ROUTING_DOMAIN}`;
}

/**
 * Provision parser routing locally (no remote parser API).
 */
async function provisionMailboxLocally({ organizationId, mailbox }) {
  const { parserTenantId, parserMailboxId } = resolveParserIdsForMailbox({
    organizationId,
    mailbox
  });
  const existingRegistry = await ParserMailboxRegistry.findOne({
    parserTenantId,
    parserMailboxId
  })
    .select('mailboxObjectId')
    .lean();
  if (
    existingRegistry
    && String(existingRegistry.mailboxObjectId) !== String(mailbox._id)
  ) {
    const message = 'Parser mailbox id already assigned to another mailbox in this tenant';
    await Mailbox.updateOne(
      { _id: mailbox._id, organizationId },
      {
        $set: {
          parserProvisionStatus: 'failed',
          parserProvisioningError: message.slice(0, 500)
        }
      }
    );
    return { ok: false, error: message };
  }
  const routingAddress = buildLocalRoutingAddress(mailbox, parserMailboxId);
  const forwardingHint =
    'Local simulation: forward support mail to this address, or use npm run simulate:parser-inbound.';

  await Mailbox.updateOne(
    { _id: mailbox._id, organizationId },
    {
      $set: {
        parserTenantId,
        parserMailboxId,
        routingAddress,
        parserForwardingHint: forwardingHint,
        parserProvisionedAt: new Date(),
        parserProvisionStatus: 'provisioned',
        parserProvisioningError: '',
        status: 'active',
        syncStatus: 'connected'
      }
    }
  );

  await ParserMailboxRegistry.findOneAndUpdate(
    { parserTenantId, parserMailboxId },
    {
      $set: {
        organizationId,
        mailboxObjectId: mailbox._id,
        mailboxKind: mailbox.kind,
        ownerUserId: mailbox.ownerUserId || null
      }
    },
    { upsert: true, new: true }
  );

  return {
    ok: true,
    local: true,
    routingAddress,
    forwardingHint,
    parserTenantId,
    parserMailboxId
  };
}

async function resolveOrganizationContext({ organizationId, userEmail }) {
  const Organization = require('../models/Organization');
  const User = require('../models/User');

  let organization = null;
  if (organizationId) {
    organization = await Organization.findById(organizationId).select('_id name').lean();
  }
  if (!organization && userEmail) {
    const user = await User.findOne({ email: String(userEmail).trim().toLowerCase() })
      .select('_id organizationId')
      .lean();
    if (user?.organizationId) {
      organization = await Organization.findById(user.organizationId).select('_id name').lean();
    }
  }
  if (!organization) {
    organization = await Organization.findOne({ isActive: { $ne: false } })
      .sort({ updatedAt: -1 })
      .select('_id name')
      .lean();
  }
  if (!organization) {
    throw new Error('No organization found. Pass --org-id or create an org first.');
  }

  let user = null;
  if (userEmail) {
    user = await User.findOne({
      organizationId: organization._id,
      email: String(userEmail).trim().toLowerCase()
    })
      .select('_id email')
      .lean();
  }
  if (!user) {
    user = await User.findOne({ organizationId: organization._id, status: { $ne: 'inactive' } })
      .sort({ updatedAt: -1 })
      .select('_id email')
      .lean();
  }
  if (!user) {
    throw new Error('No active user found for organization. Pass --user-email or --user-id.');
  }

  return { organization, user };
}

async function createSimulatedMailbox({
  organizationId,
  userId,
  kind = 'group',
  label = 'Local Support',
  emailAddress = '',
  memberUserIds = []
}) {
  if (kind !== 'personal' && kind !== 'group') {
    throw new Error('kind must be personal or group');
  }

  return runWithOrganizationTenantContext(organizationId, async () => {
    if (kind === 'personal') {
      const existing = await Mailbox.findOne({
        organizationId,
        kind: 'personal',
        ownerUserId: userId
      }).lean();
      if (existing) {
        const provision = await provisionMailboxLocally({
          organizationId,
          mailbox: existing
        });
        const refreshed = await Mailbox.findById(existing._id).lean();
        return { mailbox: refreshed, created: false, provision };
      }
    }

    const doc = await Mailbox.create({
      organizationId,
      kind,
      label: String(label || 'Local Support').trim(),
      emailAddress: emailAddress ? String(emailAddress).trim().toLowerCase() : '',
      ownerUserId: kind === 'personal' ? userId : null,
      memberUserIds: kind === 'group' ? memberUserIds : [],
      createdByUserId: userId,
      status: 'draft',
      syncStatus: 'not_configured',
      parserProvisionStatus: 'pending'
    });

    const { parserTenantId, parserMailboxId } = resolveParserIdsForMailbox({
      organizationId,
      mailbox: doc
    });
    await Mailbox.updateOne(
      { _id: doc._id, organizationId },
      { $set: { parserTenantId, parserMailboxId } }
    );
    doc.parserTenantId = parserTenantId;
    doc.parserMailboxId = parserMailboxId;

    const provision = await provisionMailboxLocally({
      organizationId,
      mailbox: doc
    });
    const refreshed = await Mailbox.findById(doc._id).lean();
    return { mailbox: refreshed, created: true, provision };
  });
}

async function listSimulatedMailboxes(organizationId) {
  return runWithOrganizationTenantContext(organizationId, async () => Mailbox.find({ organizationId })
    .sort({ kind: 1, updatedAt: -1 })
    .lean());
}

module.exports = {
  LOCAL_ROUTING_DOMAIN,
  buildLocalRoutingAddress,
  provisionMailboxLocally,
  resolveOrganizationContext,
  createSimulatedMailbox,
  listSimulatedMailboxes
};
