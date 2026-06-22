'use strict';

const domainEvents = require('./domainEvents');

/**
 * Live Chat domain events exposed to Process Designer (addon appKey: PLATFORM).
 * Payloads reference session id only — no transcript bodies in PD context.
 */
const LIVE_CHAT_PROCESS_DESIGNER_TRIGGERS = Object.freeze([
  {
    eventType: domainEvents.LIVE_CHAT_SESSION_STARTED,
    label: 'Chat started',
    entityType: 'live_chat_session',
    appKey: 'PLATFORM',
  },
  {
    eventType: domainEvents.LIVE_CHAT_MESSAGE_RECEIVED,
    label: 'Message received',
    entityType: 'live_chat_session',
    appKey: 'PLATFORM',
  },
  {
    eventType: domainEvents.LIVE_CHAT_SESSION_ASSIGNED,
    label: 'Chat assigned',
    entityType: 'live_chat_session',
    appKey: 'PLATFORM',
  },
  {
    eventType: domainEvents.LIVE_CHAT_SESSION_ENDED,
    label: 'Chat ended',
    entityType: 'live_chat_session',
    appKey: 'PLATFORM',
  },
  {
    eventType: domainEvents.LIVE_CHAT_OUTCOME_SET,
    label: 'Outcome set',
    entityType: 'live_chat_session',
    appKey: 'PLATFORM',
  },
]);

module.exports = {
  LIVE_CHAT_PROCESS_DESIGNER_TRIGGERS,
};
