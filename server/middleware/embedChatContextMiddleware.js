const Organization = require('../models/Organization');
const { tenantContext } = require('./tenantContextMiddleware');

/**
 * Resolve instance context for public embed chat routes.
 *
 * Accepts:
 * - query.instanceKey
 * - body.instanceKey
 * - header: x-instance-key
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

    const org = await Organization.findOne({
      'embed.chat.publicKey': String(instanceKey).trim(),
      'embed.chat.enabled': true
    }).lean();

    if (!org) {
      return res.status(404).json({ success: false, message: 'Instance not found' });
    }

    req.organization = org;
    req.organizationId = org._id;
    return tenantContext(req, res, next);
  } catch (err) {
    console.error('[embedChatContext] resolve instance failed:', err);
    return res.status(500).json({ success: false, message: 'Failed to resolve instance' });
  }
}

module.exports = {
  resolveEmbedChatInstance
};

