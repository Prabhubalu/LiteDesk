'use strict';

/**
 * Map Communication document fields to AMDS delivery API shape for clients.
 * @param {object|null|undefined} comm
 */
function mapCommunicationDeliveryFields(comm) {
  if (!comm) return null;

  const meta = comm.metadata || {};
  const status = String(comm.status || '').toLowerCase();
  let deliveryStatus = status;

  if (status === 'sending') deliveryStatus = 'processing';
  else if (status === 'sent') deliveryStatus = 'queued';

  return {
    status: comm.status,
    deliveryStatus,
    amdsMessageId: meta.amdsMessageId || null,
    deliveryError: meta.deliveryError || null,
    deliveryUpdatedAt: meta.deliveryUpdatedAt || null,
    bounceClassification: meta.bounceClassification || null,
    bounceDiagnostic: meta.bounceDiagnostic || null,
    bounceRecipient: meta.bounceRecipient || null,
    lastAmdsEvent: meta.lastAmdsEvent || null,
    provider: meta.provider || null,
    openedAt: meta.openedAt || null,
    openCount: meta.openCount ?? null,
    clickedAt: meta.clickedAt || null,
    clickedUrl: meta.clickedUrl || null,
    clickCount: meta.clickCount ?? null,
    amdsQueue: meta.amdsQueue || null
  };
}

module.exports = {
  mapCommunicationDeliveryFields
};
