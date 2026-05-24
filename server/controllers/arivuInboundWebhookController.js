'use strict';

const crypto = require('crypto');
const ParserInboundEvent = require('../models/ParserInboundEvent');
const { getEffectiveInboundParserConfig } = require('../services/inboundParserConfigService');
const { processParserInboundEvent } = require('../services/inboundParserMessageService');

function verifyArivuSignature(rawBody, secret, header) {
  if (!secret) return true;
  if (!header || !String(header).startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const received = String(header).slice('sha256='.length);
  if (expected.length !== received.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  } catch {
    return false;
  }
}

function processInBackground(eventId) {
  setImmediate(async () => {
    try {
      const doc = await ParserInboundEvent.findById(eventId).lean();
      if (!doc || doc.status === 'processed') return;
      await processParserInboundEvent(doc);
    } catch (err) {
      console.error('[arivuInboundWebhook] process:', err?.message || err);
      await ParserInboundEvent.updateOne(
        { _id: eventId },
        {
          $set: {
            status: 'failed',
            lastError: String(err?.message || err).slice(0, 2000)
          }
        }
      );
    }
  });
}

/**
 * POST /api/webhooks/arivu/inbound-email
 * Raw JSON body (mounted before express.json).
 */
async function handleInboundEmail(req, res) {
  try {
    const cfg = await getEffectiveInboundParserConfig();
    if (!cfg.enabled) {
      return res.status(503).json({
        ok: false,
        code: 'INBOUND_PARSER_NOT_CONFIGURED',
        message: 'Inbound parser integration is not enabled on this CRM server'
      });
    }

    const raw =
      Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');

    if (!verifyArivuSignature(raw, cfg.webhookSecret, req.headers['x-arivu-signature'])) {
      return res.status(401).json({ ok: false, error: 'Invalid signature' });
    }

    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      return res.status(400).json({ ok: false, error: 'Invalid JSON' });
    }

    if (event.event !== 'email.received') {
      return res.status(400).json({ ok: false, error: 'Unknown event type' });
    }

    const parserMessageId = String(event.messageId || '').trim();
    const parserTenantId = String(event.tenantId || '').trim();
    const parserMailboxId = String(event.mailboxId || '').trim();
    if (!parserMessageId || !parserTenantId || !parserMailboxId) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    const existing = await ParserInboundEvent.findOne({
      parserTenantId,
      parserMessageId
    }).lean();

    if (existing) {
      if (existing.status === 'failed') {
        await ParserInboundEvent.updateOne(
          { _id: existing._id },
          { $set: { status: 'received', lastError: '' } }
        );
        processInBackground(existing._id);
      }
      return res.status(200).json({ ok: true, duplicate: true });
    }

    const doc = await ParserInboundEvent.create({
      parserMessageId,
      parserTenantId,
      parserMailboxId,
      parserThreadId: String(event.threadId || '').trim(),
      receivedAt: event.receivedAt ? new Date(event.receivedAt) : new Date(),
      status: 'received'
    });

    processInBackground(doc._id);

    console.info('[arivuInboundWebhook] accepted email.received', {
      parserMessageId,
      parserTenantId,
      parserMailboxId
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[arivuInboundWebhook] handleInboundEmail:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
}

async function webhookHealth(_req, res) {
  const cfg = await getEffectiveInboundParserConfig();
  return res.json({
    ok: true,
    inboundParserEnabled: cfg.enabled,
    inboundParserConfigured: cfg.configured,
    crmWebhookUrl: cfg.crmWebhookUrl
  });
}

module.exports = {
  handleInboundEmail,
  webhookHealth
};
