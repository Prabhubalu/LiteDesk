'use strict';

const LIVE_CHAT_ASSIGNED_BY = Object.freeze({
  QUEUE_ROUTING: 'queue_routing',
  BOT: 'bot',
  MANUAL: 'manual',
  SUPERVISOR: 'supervisor',
});

const LIVE_CHAT_ASSIGNED_BY_VALUES = Object.freeze(Object.values(LIVE_CHAT_ASSIGNED_BY));

const LIVE_CHAT_ASSIGNMENT_ACTIONS = Object.freeze({
  ASSIGNED: 'assigned',
  CLAIMED: 'claimed',
  TRANSFERRED: 'transferred',
  UNASSIGNED: 'unassigned',
});

const LIVE_CHAT_ASSIGNMENT_ACTION_VALUES = Object.freeze(Object.values(LIVE_CHAT_ASSIGNMENT_ACTIONS));

function normalizeAssignedBy(raw) {
  const key = String(raw || '').trim().toLowerCase();
  return LIVE_CHAT_ASSIGNED_BY_VALUES.includes(key) ? key : null;
}

module.exports = {
  LIVE_CHAT_ASSIGNED_BY,
  LIVE_CHAT_ASSIGNED_BY_VALUES,
  LIVE_CHAT_ASSIGNMENT_ACTIONS,
  LIVE_CHAT_ASSIGNMENT_ACTION_VALUES,
  normalizeAssignedBy,
};
