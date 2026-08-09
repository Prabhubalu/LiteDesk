'use strict';

const TelephonyProviderConfig = require('../models/TelephonyProviderConfig');
const {
  getProviderByExternalAccountId,
  createAdapter,
} = require('../services/telephony/telephonyProviderRegistry');
const { processProviderWebhook } = require('../services/telephony/webhookProcessor');

function buildReqLike(req) {
  return {
    headers: req.headers,
    body: req.body,
    protocol: req.protocol,
    host: req.get('host'),
    url: req.originalUrl,
    originalUrl: req.originalUrl,
    webhookUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
  };
}

/**
 * POST /api/telephony/webhooks/:providerKey
 * Optional AccountSid / org lookup via externalAccountId.
 */
exports.handleProviderWebhook = async (req, res) => {
  try {
    const providerKey = String(req.params.providerKey || '').trim().toLowerCase();
    if (!providerKey) {
      return res.status(400).json({ success: false, message: 'providerKey required' });
    }

    const payload = req.body || {};
    const accountSid =
      payload.AccountSid || payload.accountSid || payload.account_sid || req.query.accountSid;

    let organizationId = req.query.organizationId || null;
    let config = null;

    if (accountSid) {
      const resolved = await getProviderByExternalAccountId(accountSid);
      if (resolved) {
        organizationId = resolved.organizationId;
        config = resolved.config;
      }
    }

    if (!config && organizationId) {
      config = await TelephonyProviderConfig.findOne({
        organizationId,
        providerKey,
      }).lean();
    }

    if (!config && !organizationId) {
      // Attempt active config for provider key only when uniquely identifiable — reject otherwise.
      return res.status(404).json({
        success: false,
        message: 'Unable to resolve organization for webhook',
      });
    }

    if (!config) {
      config = { providerKey, organizationId, credentials: {}, webhookSecret: '' };
    }

    const result = await processProviderWebhook({
      organizationId: organizationId || config.organizationId,
      providerKey,
      config,
      reqLike: buildReqLike(req),
      payload,
    });

    // Twilio expects 200 quickly; empty TwiML is fine for status callbacks.
    if (providerKey === 'twilio') {
      res.type('text/xml');
      return res.status(200).send('<Response></Response>');
    }
    return res.status(200).json({ success: true, data: { processed: result.processed } });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status === 401) {
      return res.status(401).json({ success: false, message: err.message });
    }
    console.error('[telephonyWebhookController] handleProviderWebhook', err);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};

/**
 * Soft validation helper for ops / debugging (still no JWT — gated by secret query in future).
 */
exports.ping = async (req, res) => {
  const providerKey = String(req.params.providerKey || 'twilio');
  try {
    createAdapter(providerKey, { providerKey });
    return res.json({ success: true, data: { providerKey, ok: true } });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
