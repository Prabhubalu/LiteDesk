'use strict';

const { getAmdsClient } = require('../../../config/amds');
const { suppressAddress } = require('../../emailSuppressionService');
const CommunicationConfig = require('../../../models/CommunicationConfig');

/**
 * Complaint — suppress recipient locally and sync to AMDS (idempotent).
 * @param {{ tenantId: string, email: string, sourceMessageId: string, eventAt?: Date }} params
 */
async function processComplaintContact(params) {
  const email = String(params.email || '').trim().toLowerCase();
  if (!params.tenantId || !email.includes('@')) return;

  let autoSuppress = true;
  try {
    const cfg = await CommunicationConfig.findOne({ organizationId: params.tenantId })
      .select('outboundEmail.suppression.autoSuppressOnComplaint')
      .lean();
    autoSuppress = cfg?.outboundEmail?.suppression?.autoSuppressOnComplaint !== false;
  } catch {
    /* default true */
  }

  if (autoSuppress) {
    await suppressAddress({
      organizationId: params.tenantId,
      email,
      reason: 'complained',
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
      reason: 'complaint'
    });
  } catch (err) {
    console.warn('[complaintContactHandler] AMDS createSuppression:', err?.message || err);
  }
}

module.exports = {
  processComplaintContact
};
