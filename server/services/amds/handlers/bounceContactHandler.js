'use strict';

const { getAmdsClient } = require('../../../config/amds');
const { suppressAddress } = require('../../emailSuppressionService');
const CommunicationConfig = require('../../../models/CommunicationConfig');

/**
 * Hard bounce — suppress recipient locally and sync to AMDS (idempotent).
 * @param {{ tenantId: string, email: string, sourceMessageId: string, eventAt?: Date }} params
 */
async function processBounceContact(params) {
  const email = String(params.email || '').trim().toLowerCase();
  if (!params.tenantId || !email.includes('@')) return;

  let autoSuppress = true;
  try {
    const cfg = await CommunicationConfig.findOne({ organizationId: params.tenantId })
      .select('outboundEmail.suppression.autoSuppressOnBounce')
      .lean();
    autoSuppress = cfg?.outboundEmail?.suppression?.autoSuppressOnBounce !== false;
  } catch {
    /* default true */
  }

  if (autoSuppress) {
    await suppressAddress({
      organizationId: params.tenantId,
      email,
      reason: 'bounced',
      source: 'amds-webhook',
      metadata: { sourceMessageId: params.sourceMessageId },
      eventAt: params.eventAt || new Date()
    });
  }

  const client = getAmdsClient();
  if (!client) return;

  try {
    await client.createSuppression({
      tenant_id: String(params.tenantId),
      email,
      reason: 'hard_bounce'
    });
  } catch (err) {
    console.warn('[bounceContactHandler] AMDS createSuppression:', err?.message || err);
  }
}

module.exports = {
  processBounceContact
};
