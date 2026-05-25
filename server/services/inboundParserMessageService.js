'use strict';

const mongoose = require('mongoose');
const Communication = require('../models/Communication');
const Mailbox = require('../models/Mailbox');
const ParserInboundEvent = require('../models/ParserInboundEvent');
const { resolveParserEventIds } = require('../utils/parserIdCodec');
const { getEffectiveInboundParserConfig } = require('./inboundParserConfigService');
const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');

function normalizeAddressList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((x) => String(x).trim()).filter(Boolean);
  }
  return [String(value).trim()].filter(Boolean);
}

function pickBody(msg) {
  return (
    String(msg.textBody || '').trim()
    || String(msg.htmlBody || '').trim()
    || String(msg.body || '').trim()
    || ''
  );
}

async function fetchParserMessage(parserMessageId) {
  const cfg = await getEffectiveInboundParserConfig();
  if (!cfg.parserApiBaseUrl) {
    throw new Error('Parser API base URL not configured');
  }
  // Use integrations API (CRM_API_KEY). /admin/messages requires admin UI session when ADMIN_PASSWORD is set.
  const url = `${cfg.parserApiBaseUrl}/integrations/v1/messages/${encodeURIComponent(parserMessageId)}`;
  const headers = { Accept: 'application/json' };
  if (cfg.parserApiKey) {
    headers.Authorization = `Bearer ${cfg.parserApiKey}`;
    headers['X-Arivu-Api-Key'] = cfg.parserApiKey;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let res;
  try {
    res = await fetch(url, { method: 'GET', headers, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Parser message fetch failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const raw = await res.json();
  const msg = raw?.message && typeof raw.message === 'object' ? raw.message : raw;
  return msg;
}

async function processParserInboundEvent(eventDoc) {
  const resolved = await resolveParserEventIds(
    eventDoc.parserTenantId,
    eventDoc.parserMailboxId
  );
  if (!resolved) {
    throw new Error(
      `Unknown parser mailbox: ${eventDoc.parserTenantId} / ${eventDoc.parserMailboxId}`
    );
  }
  const orgIdStr = resolved.organizationId;
  const mailboxIdStr = resolved.mailboxId;

  const organizationId = new mongoose.Types.ObjectId(orgIdStr);
  const mailboxObjectId = new mongoose.Types.ObjectId(mailboxIdStr);

  await ParserInboundEvent.updateOne(
    { _id: eventDoc._id },
    { $set: { status: 'processing', organizationId, mailboxObjectId } }
  );

  const msg = await fetchParserMessage(eventDoc.parserMessageId);
  if (msg.tenantId && String(msg.tenantId) !== String(eventDoc.parserTenantId)) {
    throw new Error('Parser message tenantId mismatch');
  }

  const providerMessageKey = `arivu-parser:${eventDoc.parserMessageId}`;
  const body = pickBody(msg);
  const fromAddress = String(msg.from || msg.fromAddress || '').trim();
  const subject = String(msg.subject || '').trim();
  const receivedAt = eventDoc.receivedAt || (msg.receivedAt ? new Date(msg.receivedAt) : new Date());

  let communicationId = null;

  await runWithOrganizationTenantContext(organizationId, async () => {
    const mailbox = await Mailbox.findOne({
      _id: mailboxObjectId,
      organizationId
    }).lean();
    if (!mailbox) {
      throw new Error('Mailbox not found for parser event');
    }

    const existing = await Communication.findOne({
      organizationId,
      providerMessageKey
    })
      .select('_id')
      .lean();
    if (existing) {
      communicationId = existing._id;
      return;
    }

    const doc = await Communication.create({
      organizationId,
      kind: 'email',
      direction: 'inbound',
      subject,
      body,
      fromAddress,
      toAddresses: normalizeAddressList(msg.to || msg.toAddresses),
      ccAddresses: normalizeAddressList(msg.cc || msg.ccAddresses),
      messageId: msg.messageId ? String(msg.messageId).trim() : undefined,
      receivedAt,
      status: 'delivered',
      relatedTo: { moduleKey: 'workspace', recordId: organizationId },
      mailboxId: mailboxObjectId,
      providerMessageKey,
      providerThreadId: eventDoc.parserThreadId
        ? String(eventDoc.parserThreadId).slice(0, 128)
        : msg.threadId
          ? String(msg.threadId).slice(0, 128)
          : null,
      metadata: { provider: 'arivu-inbound-parser' }
    });
    communicationId = doc._id;
  });

  await ParserInboundEvent.updateOne(
    { _id: eventDoc._id },
    {
      $set: {
        status: 'processed',
        communicationId,
        processedAt: new Date(),
        lastError: ''
      }
    }
  );

  const { emitInboxUpdated } = require('./inboxRealtimeService');
  void emitInboxUpdated({
    organizationId,
    mailboxId: mailboxObjectId,
    reason: 'inbound',
    meta: { provider: 'arivu-inbound-parser', parserMessageId: eventDoc.parserMessageId }
  });

  return { communicationId };
}

module.exports = {
  fetchParserMessage,
  processParserInboundEvent
};
