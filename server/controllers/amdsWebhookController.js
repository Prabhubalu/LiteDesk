'use strict';

const AmdsWebhookEvent = require('../models/AmdsWebhookEvent');
const { isAmdsEnvConfigured, getAmdsWebhookSecret } = require('../config/amds');
const { processCommunicationAmdsEvent } = require('../services/amds/handlers/communicationEventHandler');
const { processHelpdeskAmdsEvent } = require('../services/amds/handlers/helpdeskEventHandler');
const {
  isTenantAmdsEventType,
  processTenantEvent
} = require('../services/amds/handlers/tenantEventHandler');
const { isHelpdeskModule } = require('../services/helpdesk/caseEmailDeliveryService');

function webhookHealth(_req, res) {
  res.json({
    ok: true,
    configured: isAmdsEnvConfigured(),
    webhookSecretConfigured: !!getAmdsWebhookSecret()
  });
}

/**
 * POST /api/internal/webhooks/amds
 * Raw JSON body — mounted before express.json().
 */
async function handleAmdsWebhook(req, res) {
  try {
    const raw =
      Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');

    /** @type {import('../services/amds/amds-types').AmdsWebhookEvent} */
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    const eventId = String(event.event_id || '').trim();
    if (!eventId) {
      return res.status(400).json({ error: 'Missing event_id' });
    }

    try {
      await AmdsWebhookEvent.create({
        event_id: eventId,
        event_type: String(event.event_type || ''),
        message_id: String(event.message_id || ''),
        tenant_id: String(event.tenant_id || ''),
        payload: event
      });
    } catch (err) {
      if (err?.code === 11000) {
        return res.status(200).json({ received: true, duplicate: true });
      }
      throw err;
    }

    res.status(200).json({ received: true });

    setImmediate(async () => {
      try {
        if (isTenantAmdsEventType(event.event_type)) {
          await processTenantEvent(event);
          return;
        }

        const moduleKey = event.metadata?.litedesk_module;
        if (isHelpdeskModule(moduleKey)) {
          await processHelpdeskAmdsEvent(event);
          return;
        }
        await processCommunicationAmdsEvent(event);
      } catch (err) {
        console.error('[amdsWebhook] event processing failed:', err?.message || err);
      }
    });
  } catch (err) {
    console.error('[amdsWebhook] handler error:', err?.message || err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal error' });
    }
  }
}

module.exports = {
  webhookHealth,
  handleAmdsWebhook
};
