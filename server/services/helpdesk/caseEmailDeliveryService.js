'use strict';

const mongoose = require('mongoose');
const Case = require('../../models/Case');
const Communication = require('../../models/Communication');
const { mapCommunicationDeliveryFields } = require('../amds/deliveryFields');
const { resolveCommunicationId } = require('../amds/handlers/communicationEventHandler');
const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');

const HELPDESK_MODULE_KEYS = new Set(['helpdesk', 'cases']);

function isHelpdeskModule(moduleKey) {
  return HELPDESK_MODULE_KEYS.has(String(moduleKey || '').trim().toLowerCase());
}

function deliveryFieldsFromEvent(event) {
  let deliveryStatus = 'failed';
  if (event.event_type === 'message.delivered') {
    deliveryStatus = 'delivered';
  } else if (event.event_type === 'message.bounced') {
    deliveryStatus = 'bounced';
  }

  return {
    deliveryStatus,
    amdsMessageId: String(event.message_id || '').trim() || null,
    deliveryError:
      event.event_type === 'message.failed'
        ? String(event.delivery?.error || 'Unknown error').slice(0, 2000)
        : event.event_type === 'message.bounced'
          ? String(event.bounce?.diagnostic || 'Email bounced').slice(0, 2000)
          : null,
    bounceClassification: event.bounce?.classification || null,
    bounceDiagnostic: event.bounce?.diagnostic || null,
    bounceRecipient: event.bounce?.recipient || null,
    deliveryUpdatedAt: event.timestamp ? new Date(event.timestamp) : new Date()
  };
}

/**
 * Update embedded case activity when AMDS webhook confirms delivery.
 * @param {import('../amds/amds-types').AmdsWebhookEvent} event
 */
async function updateCaseActivityFromAmdsWebhook(event) {
  const organizationId = event.metadata?.litedesk_org_id || event.tenant_id || null;
  const communicationId = resolveCommunicationId(event);
  let caseId = event.metadata?.litedesk_case_id || null;

  if (!organizationId || !communicationId) return;

  await runWithOrganizationTenantContext(organizationId, async () => {
    if (!caseId) {
      const comm = await Communication.findOne({
        _id: communicationId,
        organizationId
      })
        .select('relatedTo')
        .lean();
      if (comm?.relatedTo?.moduleKey === 'cases' && comm.relatedTo.recordId) {
        caseId = String(comm.relatedTo.recordId);
      }
    }

    if (!caseId || !mongoose.Types.ObjectId.isValid(String(caseId))) return;

    const fields = deliveryFieldsFromEvent(event);
    const commIdStr = String(communicationId);

    await Case.updateOne(
      {
        _id: caseId,
        organizationId,
        deletedAt: null,
        'activities.metadata.communicationId': commIdStr
      },
      {
        $set: {
          'activities.$[act].metadata.deliveryStatus': fields.deliveryStatus,
          'activities.$[act].metadata.amdsMessageId': fields.amdsMessageId,
          'activities.$[act].metadata.deliveryError': fields.deliveryError,
          'activities.$[act].metadata.deliveryUpdatedAt': fields.deliveryUpdatedAt,
          'activities.$[act].metadata.status': fields.deliveryStatus,
          'activities.$[act].metadata.bounceClassification': fields.bounceClassification,
          'activities.$[act].metadata.bounceDiagnostic': fields.bounceDiagnostic,
          'activities.$[act].metadata.bounceRecipient': fields.bounceRecipient
        }
      },
      {
        arrayFilters: [{ 'act.metadata.communicationId': commIdStr }]
      }
    );
  });
}

/**
 * Join Communication delivery fields onto case timeline activities.
 * @param {string} organizationId
 * @param {object[]} activities
 */
async function enrichCaseActivitiesWithEmailDelivery(organizationId, activities = []) {
  if (!organizationId || !Array.isArray(activities) || activities.length === 0) {
    return activities;
  }

  const communicationIds = [
    ...new Set(
      activities
        .map((act) => String(act?.metadata?.communicationId || '').trim())
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
    )
  ];

  if (!communicationIds.length) return activities;

  const comms = await Communication.find({
    organizationId,
    _id: { $in: communicationIds }
  })
    .select('status metadata providerMessageKey')
    .lean();

  const byId = new Map(comms.map((c) => [String(c._id), c]));

  return activities.map((act) => {
    const commId = String(act?.metadata?.communicationId || '').trim();
    const comm = byId.get(commId);
    if (!comm) return act;

    const delivery = mapCommunicationDeliveryFields(comm);
    return {
      ...act,
      metadata: {
        ...act.metadata,
        ...delivery
      }
    };
  });
}

module.exports = {
  isHelpdeskModule,
  updateCaseActivityFromAmdsWebhook,
  enrichCaseActivitiesWithEmailDelivery,
  deliveryFieldsFromEvent
};
