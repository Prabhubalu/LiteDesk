'use strict';

const domainEvents = require('./domainEvents');

/**
 * Telephony domain events exposed to Process Designer (addon appKey: PLATFORM).
 */
const TELEPHONY_PROCESS_DESIGNER_TRIGGERS = Object.freeze([
  {
    eventType: domainEvents.TELEPHONY_INCOMING_CALL,
    label: 'Incoming call',
    entityType: 'telephony_call',
    appKey: 'PLATFORM',
  },
  {
    eventType: domainEvents.TELEPHONY_CALL_ANSWERED,
    label: 'Call answered',
    entityType: 'telephony_call',
    appKey: 'PLATFORM',
  },
  {
    eventType: domainEvents.TELEPHONY_CALL_ENDED,
    label: 'Call ended',
    entityType: 'telephony_call',
    appKey: 'PLATFORM',
  },
  {
    eventType: domainEvents.TELEPHONY_CALL_MISSED,
    label: 'Missed call',
    entityType: 'telephony_call',
    appKey: 'PLATFORM',
  },
  {
    eventType: domainEvents.TELEPHONY_RECORDING_READY,
    label: 'Recording ready',
    entityType: 'telephony_call',
    appKey: 'PLATFORM',
  },
  {
    eventType: domainEvents.TELEPHONY_VOICEMAIL_RECEIVED,
    label: 'Voicemail received',
    entityType: 'telephony_call',
    appKey: 'PLATFORM',
  },
  {
    eventType: domainEvents.TELEPHONY_TRANSCRIPT_READY,
    label: 'Transcript ready',
    entityType: 'telephony_call',
    appKey: 'PLATFORM',
  },
  {
    eventType: domainEvents.TELEPHONY_SUMMARY_READY,
    label: 'Summary ready',
    entityType: 'telephony_call',
    appKey: 'PLATFORM',
  },
]);

module.exports = {
  TELEPHONY_PROCESS_DESIGNER_TRIGGERS,
};
