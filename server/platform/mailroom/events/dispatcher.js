'use strict';

const { emit: emitDomainEvent } = require('../../../services/domainEvents');
const {
  MAILROOM_DOMAIN_BRIDGE_EVENTS,
  CASE_ACTIONS_WITH_DOMAIN_EVENT
} = require('../../../constants/mailroomEvents');

/**
 * Bridge Mailroom events to domain events / downstream systems per dispatch policy.
 * Case create/reopen domain events are emitted by caseExecutionService — skip duplicates.
 */
function dispatchMailroomEvent(envelope, { caseResult = null } = {}) {
  const bridgeType = MAILROOM_DOMAIN_BRIDGE_EVENTS[envelope.eventType];
  if (!bridgeType) {
    return { dispatched: false, reason: 'no_bridge' };
  }

  if (envelope.eventType === 'case.created' || envelope.eventType === 'case.reopened') {
    const action = caseResult?.action || '';
    if (CASE_ACTIONS_WITH_DOMAIN_EVENT.includes(action)) {
      return { dispatched: false, reason: 'domain_event_already_emitted' };
    }
  }

  const caseId = envelope.caseId || caseResult?.caseId;
  if (!caseId && (envelope.eventType === 'case.created' || envelope.eventType === 'case.reopened')) {
    return { dispatched: false, reason: 'missing_case_id' };
  }

  const entityId = caseId || envelope.conversationId || envelope.rawPayloadId;
  if (!entityId) {
    return { dispatched: false, reason: 'missing_entity_id' };
  }

  emitDomainEvent({
    entityType: envelope.eventType.startsWith('case.') ? 'case' : 'mailroom',
    entityId,
    eventType: bridgeType,
    organizationId: envelope.organizationId,
    triggeredBy: 'mailroom',
    appKey: 'HELPDESK',
    ownerId: envelope.data?.caseOwnerId || null,
    previousState: envelope.data?.previousState || null,
    currentState: envelope.data?.currentState || null
  });

  return { dispatched: true, bridgeType };
}

module.exports = {
  dispatchMailroomEvent
};
