const TYPING_TTL_MS = 5000;

// sessionId -> { agent?: { authorName, expiresAt }, visitor?: { authorName, expiresAt } }
const state = new Map();

function now() {
  return Date.now();
}

function toKey(sessionId) {
  return sessionId?.toString ? sessionId.toString() : String(sessionId || '');
}

function setTyping({ sessionId, authorType, authorName }) {
  const key = toKey(sessionId);
  if (!key) return;
  const type = String(authorType || '').trim();
  if (type !== 'agent' && type !== 'visitor') return;
  const current = state.get(key) || {};
  current[type] = {
    authorName: String(authorName || '').trim() || (type === 'agent' ? 'Agent' : 'Visitor'),
    expiresAt: now() + TYPING_TTL_MS
  };
  state.set(key, current);
}

function clearTyping(sessionId) {
  state.delete(toKey(sessionId));
}

function getTypingState(sessionId) {
  const key = toKey(sessionId);
  const row = state.get(key);
  if (!row) return null;
  const t = now();
  const out = {};
  if (row.agent && row.agent.expiresAt > t) {
    out.agent = { authorType: 'agent', authorName: row.agent.authorName };
  }
  if (row.visitor && row.visitor.expiresAt > t) {
    out.visitor = { authorType: 'visitor', authorName: row.visitor.authorName };
  }
  if (!out.agent && !out.visitor) {
    state.delete(key);
    return null;
  }
  return out;
}

module.exports = {
  setTyping,
  clearTyping,
  getTypingState,
  TYPING_TTL_MS
};

