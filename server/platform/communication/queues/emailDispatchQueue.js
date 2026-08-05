const emailQueueService = require('../../../services/emailQueueService');

function enqueueCommunicationSend(communicationId, organizationId) {
  return emailQueueService.enqueueSend(communicationId, organizationId);
}

function enqueueCommunicationSendDelayed(communicationId, organizationId, runAt) {
  return emailQueueService.enqueueSendDelayed(communicationId, organizationId, runAt);
}

function isQueueAvailable() {
  return emailQueueService.isQueueAvailable();
}

module.exports = {
  enqueueCommunicationSend,
  enqueueCommunicationSendDelayed,
  isQueueAvailable
};
