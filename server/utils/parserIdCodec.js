'use strict';

const mongoose = require('mongoose');
const ParserMailboxRegistry = require('../models/ParserMailboxRegistry');

const TENANT_PREFIX = 't_';
const MAILBOX_PREFIX = 'm_';
/** @deprecated Legacy 4-char ids; kept for registry lookups only. New ids use full ObjectId hex. */
const SHORT_PARSER_ID_HEX_LENGTH = 4;

function objectIdToParserHex(objectId) {
  const hex = String(objectId || '').trim();
  if (!mongoose.Types.ObjectId.isValid(hex)) return '';
  return hex;
}

function toParserTenantId(organizationId) {
  const raw = String(organizationId || '').trim();
  if (!raw) return '';
  if (raw.startsWith(TENANT_PREFIX)) {
    const suffix = raw.slice(TENANT_PREFIX.length);
    if (mongoose.Types.ObjectId.isValid(suffix)) {
      return `${TENANT_PREFIX}${suffix}`;
    }
    return raw;
  }
  const hex = objectIdToParserHex(raw);
  return hex ? `${TENANT_PREFIX}${hex}` : '';
}

function toParserMailboxId(mailboxId) {
  const raw = String(mailboxId || '').trim();
  if (!raw) return '';
  if (raw.startsWith(MAILBOX_PREFIX)) {
    const suffix = raw.slice(MAILBOX_PREFIX.length);
    if (mongoose.Types.ObjectId.isValid(suffix)) {
      return `${MAILBOX_PREFIX}${suffix}`;
    }
    return raw;
  }
  const hex = objectIdToParserHex(raw);
  return hex ? `${MAILBOX_PREFIX}${hex}` : '';
}

function parseParserTenantId(parserTenantId) {
  const raw = String(parserTenantId || '').trim();
  if (!raw.startsWith(TENANT_PREFIX)) return null;
  const id = raw.slice(TENANT_PREFIX.length);
  return mongoose.Types.ObjectId.isValid(id) ? id : null;
}

function parseParserMailboxId(parserMailboxId) {
  const raw = String(parserMailboxId || '').trim();
  if (!raw.startsWith(MAILBOX_PREFIX)) return null;
  const id = raw.slice(MAILBOX_PREFIX.length);
  return mongoose.Types.ObjectId.isValid(id) ? id : null;
}

/**
 * Resolve parser webhook ids → CRM org + mailbox (short ids via registry; legacy full ObjectIds).
 */
async function resolveParserEventIds(parserTenantId, parserMailboxId) {
  const pt = String(parserTenantId || '').trim();
  const pm = String(parserMailboxId || '').trim();
  if (!pt || !pm) return null;

  const orgFull = parseParserTenantId(pt);
  const mbFull = parseParserMailboxId(pm);
  if (orgFull && mbFull) {
    return { organizationId: orgFull, mailboxId: mbFull };
  }

  const row = await ParserMailboxRegistry.findOne({
    parserTenantId: pt,
    parserMailboxId: pm
  })
    .select('organizationId mailboxObjectId')
    .lean();

  if (!row) return null;

  return {
    organizationId: String(row.organizationId),
    mailboxId: String(row.mailboxObjectId)
  };
}

/**
 * Resolve stable, unique parser tenant/mailbox ids for a CRM mailbox document.
 * Uses full ObjectId hex (one id per personal or group mailbox).
 * Upgrades legacy 4-char short ids on re-provision.
 */
function resolveParserIdsForMailbox({ organizationId, mailbox }) {
  let parserTenantId = String(mailbox?.parserTenantId || '').trim();
  let parserMailboxId = String(mailbox?.parserMailboxId || '').trim();
  if (!parserTenantId || !parseParserTenantId(parserTenantId)) {
    parserTenantId = toParserTenantId(organizationId);
  }
  if (!parserMailboxId || !parseParserMailboxId(parserMailboxId)) {
    parserMailboxId = toParserMailboxId(mailbox?._id);
  }
  return { parserTenantId, parserMailboxId };
}

function routingLocalPartFromMailbox({ label, emailAddress, kind, ownerUserId, mailboxObjectId }) {
  const fromEmail = String(emailAddress || '').trim().toLowerCase();
  if (fromEmail.includes('@')) {
    const local = fromEmail.split('@')[0].replace(/[^a-z0-9-]/gi, '').slice(0, 40);
    if (local) return local;
  }
  const slug = String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  let base = slug || (kind === 'personal' ? 'personal' : 'support');
  if (kind === 'personal' && ownerUserId) {
    const ownerHex = objectIdToParserHex(ownerUserId);
    if (ownerHex) {
      base = `${base}-${ownerHex.slice(-8)}`.replace(/^-+|-+$/g, '').slice(0, 40);
    }
  } else if (kind === 'group' && mailboxObjectId) {
    const mbHex = objectIdToParserHex(mailboxObjectId);
    if (mbHex) {
      base = `${base}-${mbHex.slice(-8)}`.replace(/^-+|-+$/g, '').slice(0, 40);
    }
  }
  return base;
}

module.exports = {
  TENANT_PREFIX,
  MAILBOX_PREFIX,
  SHORT_PARSER_ID_HEX_LENGTH,
  toParserTenantId,
  toParserMailboxId,
  parseParserTenantId,
  parseParserMailboxId,
  resolveParserIdsForMailbox,
  resolveParserEventIds,
  routingLocalPartFromMailbox
};
