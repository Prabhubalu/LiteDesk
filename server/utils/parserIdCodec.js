'use strict';

const mongoose = require('mongoose');
const ParserMailboxRegistry = require('../models/ParserMailboxRegistry');

const TENANT_PREFIX = 't_';
const MAILBOX_PREFIX = 'm_';
/** Hex chars from Mongo ObjectId used in plus-address (keeps addresses short). */
const SHORT_PARSER_ID_HEX_LENGTH = 4;

function objectIdToShortHex(objectId) {
  const hex = String(objectId || '').trim();
  if (!mongoose.Types.ObjectId.isValid(hex)) return '';
  return hex.slice(0, SHORT_PARSER_ID_HEX_LENGTH);
}

function toParserTenantId(organizationId) {
  const raw = String(organizationId || '').trim();
  if (!raw) return '';
  if (raw.startsWith(TENANT_PREFIX)) {
    const suffix = raw.slice(TENANT_PREFIX.length);
    if (mongoose.Types.ObjectId.isValid(suffix)) {
      return `${TENANT_PREFIX}${objectIdToShortHex(suffix)}`;
    }
    return raw;
  }
  return `${TENANT_PREFIX}${objectIdToShortHex(raw)}`;
}

function toParserMailboxId(mailboxId) {
  const raw = String(mailboxId || '').trim();
  if (!raw) return '';
  if (raw.startsWith(MAILBOX_PREFIX)) {
    const suffix = raw.slice(MAILBOX_PREFIX.length);
    if (mongoose.Types.ObjectId.isValid(suffix)) {
      return `${MAILBOX_PREFIX}${objectIdToShortHex(suffix)}`;
    }
    return raw;
  }
  return `${MAILBOX_PREFIX}${objectIdToShortHex(raw)}`;
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

function routingLocalPartFromMailbox({ label, emailAddress, kind }) {
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
  if (slug) return slug;
  return kind === 'personal' ? 'personal' : 'support';
}

module.exports = {
  TENANT_PREFIX,
  MAILBOX_PREFIX,
  SHORT_PARSER_ID_HEX_LENGTH,
  toParserTenantId,
  toParserMailboxId,
  parseParserTenantId,
  parseParserMailboxId,
  resolveParserEventIds,
  routingLocalPartFromMailbox
};
