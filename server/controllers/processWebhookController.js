'use strict';

const { invokeProcessWebhook } = require('../services/processWebhookService');

/**
 * POST /api/hooks/process/:webhookKey
 * Public — Bearer secret + optional X-Process-Webhook-Signature (HMAC-SHA256 of raw body).
 */
exports.handleProcessWebhook = async (req, res) => {
  try {
    const webhookKey = String(req.params.webhookKey || '').trim();
    if (!webhookKey) {
      return res.status(400).json({ success: false, message: 'webhookKey required' });
    }

    const result = await invokeProcessWebhook({
      webhookKey,
      req,
      body: req.body
    });

    if (!result.ok) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.error || 'Webhook failed'
      });
    }

    return res.status(result.status || 202).json({
      success: true,
      executionId: result.executionId,
      skipped: result.skipped || false,
      paused: result.paused || false
    });
  } catch (err) {
    console.error('[processWebhook]', err.message);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};
