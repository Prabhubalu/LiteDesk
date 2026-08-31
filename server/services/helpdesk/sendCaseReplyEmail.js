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
const { writeMetadata } = require('../../utils/arivuMetadata');

/**
 * @param {{ organizationId: string, caseId: string, communicationId: string }} params
 */
function buildCaseAmdsMetadata(params) {
  return writeMetadata({
    module: 'helpdesk',
    entity_id: String(params.communicationId),
    communication_id: String(params.communicationId),
    case_id: String(params.caseId),
    org_id: String(params.organizationId)
  });
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
