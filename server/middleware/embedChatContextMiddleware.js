const Organization = require('../models/Organization');
const { tenantContext } = require('./tenantContextMiddleware');
const { resolvePublicEmbedContext } = require('../services/liveChatWidgetService');

/**
 * Resolve instance context for public embed chat routes.
 *
 * Accepts:
 * - query.instanceKey
 * - body.instanceKey
 * - header: x-instance-key
 *
 * Requires Live Chat addon entitlement + widget enabled for tenant.
 */
async function resolveEmbedChatInstance(req, res, next) {
  try {
    const instanceKey =
      req.query?.instanceKey
      || req.body?.instanceKey
      || req.headers['x-instance-key']
      || null;

    if (!instanceKey) {
      return res.status(400).json({ success: false, message: 'instanceKey is required' });
    }

    const ctx = await resolvePublicEmbedContext(instanceKey);
    if (!ctx?.organization) {
      return res.status(404).json({
        success: false,
        message: 'Chat widget is not available for this instance',
        code: 'LIVE_CHAT_EMBED_UNAVAILABLE',
      });
    }

    req.organization = ctx.organization;
    req.organizationId = ctx.organization._id;
    req.liveChatWidget = ctx.widget;
    return tenantContext(req, res, next);
  } catch (err) {
    console.error('[embedChatContext] resolve instance failed:', err);
    return res.status(500).json({ success: false, message: 'Failed to resolve instance' });
  }
}

module.exports = {
  resolveEmbedChatInstance,
};
