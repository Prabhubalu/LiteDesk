const {
  SUPPORTED_MODULES,
  normalizeSendEmailPayload
} = require('../domain/sendEmailContract');
const emailProviderGateway = require('../providers/emailProviderGateway');
const emailDispatchQueue = require('../queues/emailDispatchQueue');
const outboundEmailSendService = require('../outbound/outboundEmailSendService');

function validateOutboundEmailPayload(payload) {
  return normalizeSendEmailPayload(payload);
}

async function canSendEmailNow(context = {}) {
  return outboundEmailSendService.canSendEmailNow(context);
}

function getSupportedModules() {
  return Array.from(SUPPORTED_MODULES);
}

function enqueueOutboundEmail(communicationId, organizationId) {
  return emailDispatchQueue.enqueueCommunicationSend(communicationId, organizationId);
}

function enqueueOutboundEmailDelayed(communicationId, organizationId, runAt) {
  return emailDispatchQueue.enqueueCommunicationSendDelayed(communicationId, organizationId, runAt);
}

module.exports = {
  validateOutboundEmailPayload,
  canSendEmailNow,
  getSupportedModules,
  enqueueOutboundEmail,
  enqueueOutboundEmailDelayed
};
