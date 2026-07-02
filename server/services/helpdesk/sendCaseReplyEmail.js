'use strict';

/**
 * Helpdesk case outbound email (Phase 0a).
 *
 * Production path: POST /api/communications/email with
 *   relatedTo: { moduleKey: 'cases', recordId: <caseId> }
 *
 * That flow creates a Communication, enqueues AMDS send, and links a Case activity.
 * Webhooks update Communication.status and the case activity delivery fields.
 *
 * This module documents the contract and builds AMDS metadata for case sends.
 */

const amdsEmailDelivery = require('../emailProviders/amdsEmailDelivery');

/**
 * @param {{ organizationId: string, caseId: string, communicationId: string }} params
 */
function buildCaseAmdsMetadata(params) {
  return {
    litedesk_module: 'helpdesk',
    litedesk_entity_id: String(params.communicationId),
    litedesk_communication_id: String(params.communicationId),
    litedesk_case_id: String(params.caseId),
    litedesk_org_id: String(params.organizationId)
  };
}

/**
 * @param {{ organizationId: string, caseId: string, communicationId: string }} params
 */
function buildCaseIdempotencyKey(params) {
  return amdsEmailDelivery.buildCommunicationIdempotencyKey({
    moduleKey: 'cases',
    organizationId: params.organizationId,
    communicationId: params.communicationId
  });
}

module.exports = {
  buildCaseAmdsMetadata,
  buildCaseIdempotencyKey
};
