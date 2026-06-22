const LiveChatSequence = require('../models/LiveChatSequence');

/**
 * Allocate a human-readable session key (CHAT-1052) per tenant.
 */
async function allocateSessionKey(organizationId) {
  if (!organizationId) {
    return `CHAT-${Date.now()}`;
  }

  const seq = await LiveChatSequence.findOneAndUpdate(
    { organizationId },
    { $inc: { nextValue: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: { nextValue: 1000 } },
  );

  return `CHAT-${seq.nextValue}`;
}

module.exports = {
  allocateSessionKey,
};
