'use strict';

const LIVE_CHAT_VISITOR_TYPES = Object.freeze({
  ANONYMOUS: 'anonymous',
  KNOWN_VISITOR: 'known_visitor',
  CUSTOMER: 'customer',
  PARTNER: 'partner',
});

const LIVE_CHAT_VISITOR_TYPE_VALUES = Object.freeze(Object.values(LIVE_CHAT_VISITOR_TYPES));

const LIVE_CHAT_SESSION_PRIORITIES = Object.freeze({
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
});

const LIVE_CHAT_SESSION_PRIORITY_VALUES = Object.freeze(Object.values(LIVE_CHAT_SESSION_PRIORITIES));

const MAX_INTERNAL_NOTES_LENGTH = 10000;
const MAX_SESSION_NOTE_LENGTH = 5000;

function normalizeVisitorType(raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return null;
  return LIVE_CHAT_VISITOR_TYPE_VALUES.includes(key) ? key : null;
}

function normalizeSessionPriority(raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return null;
  return LIVE_CHAT_SESSION_PRIORITY_VALUES.includes(key) ? key : null;
}

function normalizeInternalNotes(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim().slice(0, MAX_INTERNAL_NOTES_LENGTH);
}

function normalizeSessionNoteBody(raw) {
  const body = String(raw || '').trim();
  if (!body) return '';
  return body.slice(0, MAX_SESSION_NOTE_LENGTH);
}

function inferVisitorTypeFromVisitor(visitor = {}) {
  const email = String(visitor?.email || '').trim();
  const name = String(visitor?.name || '').trim();
  if (!email && !name) return LIVE_CHAT_VISITOR_TYPES.ANONYMOUS;
  return LIVE_CHAT_VISITOR_TYPES.KNOWN_VISITOR;
}

module.exports = {
  LIVE_CHAT_VISITOR_TYPES,
  LIVE_CHAT_VISITOR_TYPE_VALUES,
  LIVE_CHAT_SESSION_PRIORITIES,
  LIVE_CHAT_SESSION_PRIORITY_VALUES,
  MAX_INTERNAL_NOTES_LENGTH,
  MAX_SESSION_NOTE_LENGTH,
  normalizeVisitorType,
  normalizeSessionPriority,
  normalizeInternalNotes,
  normalizeSessionNoteBody,
  inferVisitorTypeFromVisitor,
};
