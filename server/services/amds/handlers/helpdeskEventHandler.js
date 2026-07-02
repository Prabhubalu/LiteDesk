'use strict';

const { processCommunicationAmdsEvent } = require('./communicationEventHandler');
const { updateCaseActivityFromAmdsWebhook } = require('../../helpdesk/caseEmailDeliveryService');

/**
 * Helpdesk / case outbound email — AMDS webhook handler.
 * Updates Communication (canonical record) and linked Case activity.
 *
 * @param {import('../amds-types').AmdsWebhookEvent} event
 */
async function processHelpdeskAmdsEvent(event) {
  await processCommunicationAmdsEvent(event);
  await updateCaseActivityFromAmdsWebhook(event);
}

module.exports = {
  processHelpdeskAmdsEvent
};
