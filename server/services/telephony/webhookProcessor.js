'use strict';

const { createAdapter } = require('./telephonyProviderRegistry');
const { handleNormalizedWebhook } = require('./callManager');

/**
 * Validate + normalize provider webhook, then process via callManager (idempotent).
 */
async function processProviderWebhook({
  organizationId,
  providerKey,
  config,
  reqLike,
  payload,
}) {
  const adapter = createAdapter(providerKey, config || { providerKey, organizationId });
  const valid = await Promise.resolve(adapter.validateWebhook(reqLike));
  if (!valid) {
    const err = new Error('Invalid webhook signature');
    err.statusCode = 401;
    throw err;
  }

  const event = adapter.normalizeWebhookEvent(payload || reqLike.body || {});
  return handleNormalizedWebhook({
    organizationId,
    providerKey: adapter.providerKey,
    event,
    adapter,
  });
}

module.exports = {
  processProviderWebhook,
};
