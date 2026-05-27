/**
 * Mailroom event catalog (spec §17).
 */

const MAILROOM_EVENT_TYPES = Object.freeze([
  'message.received',
  'message.normalized',
  'conversation.created',
  'conversation.updated',
  'case.created',
  'case.reopened',
  'attachment.uploaded',
  'duplicate.detected',
  'processing.failed'
]);

/** Domain events bridged from Mailroom when dispatch policy allows (automation engine). */
const MAILROOM_DOMAIN_BRIDGE_EVENTS = Object.freeze({
  'case.created': 'case.created',
  'case.reopened': 'case.reopened',
  'duplicate.detected': 'mailroom.duplicate.detected'
});

/** Case adapter actions that already emit domain events via caseExecutionService. */
const CASE_ACTIONS_WITH_DOMAIN_EVENT = Object.freeze([
  'created_case',
  'created_case_flagged',
  'reopened_and_appended'
]);

module.exports = {
  MAILROOM_EVENT_TYPES,
  MAILROOM_DOMAIN_BRIDGE_EVENTS,
  CASE_ACTIONS_WITH_DOMAIN_EVENT
};
