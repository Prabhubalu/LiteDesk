'use strict';

/**
 * sessionMemory — ephemeral, in-process conversation buffer keyed by session id.
 * Bounded ring buffer; NOT durable and NOT tenant storage. Durable facts belong
 * in personal/org memory. Safe for a single Node process; multi-instance
 * deployments should treat this as best-effort continuity only.
 */

const MAX_TURNS = 24;
const MAX_SESSIONS = 2000;

/** @type {Map<string, Array<{role: string, content: string, at: number}>>} */
const store = new Map();

/** @type {Map<string, { kind: string, id?: string, name?: string, moduleKey?: string, at: number }>} */
const focusStore = new Map();

/** @type {Map<string, object>} */
const scratchStore = new Map();

function key(organizationId, sessionId) {
  return `${organizationId || 'none'}::${sessionId || 'default'}`;
}

function append(organizationId, sessionId, turn) {
  const k = key(organizationId, sessionId);
  const list = store.get(k) || [];
  list.push({
    role: turn.role || 'user',
    content: String(turn.content || ''),
    at: Date.now(),
  });
  while (list.length > MAX_TURNS) list.shift();
  store.set(k, list);

  // Coarse eviction to bound memory footprint.
  if (store.size > MAX_SESSIONS) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  return list;
}

function history(organizationId, sessionId) {
  return store.get(key(organizationId, sessionId)) || [];
}

function clear(organizationId, sessionId) {
  const k = key(organizationId, sessionId);
  store.delete(k);
  focusStore.delete(k);
  scratchStore.delete(k);
}

/**
 * Conversation focus — last deal/org/person/case for multi-seat continuity.
 * @param {string} organizationId
 * @param {string} sessionId
 * @param {{ kind: string, id?: string, name?: string, moduleKey?: string }|null} focus
 */
function setFocus(organizationId, sessionId, focus) {
  const k = key(organizationId, sessionId);
  if (!focus || !focus.kind) {
    focusStore.delete(k);
    return null;
  }
  const value = {
    kind: String(focus.kind),
    id: focus.id ? String(focus.id) : undefined,
    name: focus.name ? String(focus.name) : undefined,
    moduleKey: focus.moduleKey ? String(focus.moduleKey) : undefined,
    startDateTime: focus.startDateTime ? String(focus.startDateTime) : undefined,
    endDateTime: focus.endDateTime ? String(focus.endDateTime) : undefined,
    at: Date.now(),
  };
  focusStore.set(k, value);
  return value;
}

function getFocus(organizationId, sessionId) {
  return focusStore.get(key(organizationId, sessionId)) || null;
}

/** Shared findings across seats in a playbook / multi-turn plan. */
function setScratchpad(organizationId, sessionId, data) {
  const k = key(organizationId, sessionId);
  if (!data || typeof data !== 'object') {
    scratchStore.delete(k);
    return null;
  }
  const value = { ...data, at: Date.now() };
  scratchStore.set(k, value);
  return value;
}

function getScratchpad(organizationId, sessionId) {
  return scratchStore.get(key(organizationId, sessionId)) || null;
}

function resetForTests() {
  store.clear();
  focusStore.clear();
  scratchStore.clear();
}

module.exports = {
  append,
  history,
  clear,
  setFocus,
  getFocus,
  setScratchpad,
  getScratchpad,
  resetForTests,
  MAX_TURNS,
};
