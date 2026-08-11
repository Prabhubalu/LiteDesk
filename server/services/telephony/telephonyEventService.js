'use strict';

const { emit: emitDomainEvent } = require('../domainEvents');
const domainEvents = require('../../constants/domainEvents');

function emitTelephonyDomainEvent({
  organizationId,
  callId,
  eventType,
  triggeredBy = null,
  metadata = {},
  currentState = null,
  previousState = null,
  changedFields = [],
}) {
  try {
    emitDomainEvent({
      entityType: 'telephony_call',
      entityId: String(callId),
      eventType,
      appKey: 'PLATFORM',
      organizationId,
      triggeredBy,
      metadata,
      previousState,
      currentState: currentState || metadata,
      changedFields,
    });
  } catch (err) {
    console.warn('[telephonyEventService] emit failed', {
      eventType,
      callId: String(callId),
      error: err?.message,
    });
  }
}

function emitIncomingCall({ organizationId, callId, metadata = {} }) {
  emitTelephonyDomainEvent({
    organizationId,
    callId,
    eventType: domainEvents.TELEPHONY_INCOMING_CALL,
    metadata,
    currentState: metadata,
  });
}

function emitCallAnswered({ organizationId, callId, metadata = {}, triggeredBy = null }) {
  emitTelephonyDomainEvent({
    organizationId,
    callId,
    eventType: domainEvents.TELEPHONY_CALL_ANSWERED,
    triggeredBy,
    metadata,
    currentState: metadata,
    changedFields: ['status', 'answeredAt'],
  });
}

function emitCallEnded({ organizationId, callId, metadata = {}, triggeredBy = null }) {
  emitTelephonyDomainEvent({
    organizationId,
    callId,
    eventType: domainEvents.TELEPHONY_CALL_ENDED,
    triggeredBy,
    metadata,
    currentState: metadata,
    changedFields: ['status', 'endedAt', 'durationSeconds'],
  });
}

function emitCallMissed({ organizationId, callId, metadata = {} }) {
  emitTelephonyDomainEvent({
    organizationId,
    callId,
    eventType: domainEvents.TELEPHONY_CALL_MISSED,
    metadata,
    currentState: metadata,
  });
}

function emitRecordingReady({ organizationId, callId, metadata = {} }) {
  emitTelephonyDomainEvent({
    organizationId,
    callId,
    eventType: domainEvents.TELEPHONY_RECORDING_READY,
    metadata,
    currentState: metadata,
  });
}

function emitTranscriptReady({ organizationId, callId, metadata = {} }) {
  emitTelephonyDomainEvent({
    organizationId,
    callId,
    eventType: domainEvents.TELEPHONY_TRANSCRIPT_READY,
    metadata,
    currentState: metadata,
  });
}

function emitSummaryReady({ organizationId, callId, metadata = {} }) {
  emitTelephonyDomainEvent({
    organizationId,
    callId,
    eventType: domainEvents.TELEPHONY_SUMMARY_READY,
    metadata,
    currentState: metadata,
  });
}

module.exports = {
  emitTelephonyDomainEvent,
  emitIncomingCall,
  emitCallAnswered,
  emitCallEnded,
  emitCallMissed,
  emitRecordingReady,
  emitTranscriptReady,
  emitSummaryReady,
};
