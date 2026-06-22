'use strict';

function toTimestamp(value) {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

/**
 * Computed session timing metrics (milliseconds). Not persisted on ChatSession.
 */
function computeSessionTimingFields(session) {
  const createdAt = toTimestamp(session?.createdAt);
  const assignedAt = toTimestamp(session?.assignedAt);
  const firstResponseAt = toTimestamp(session?.firstResponseAt);
  const endedAt = toTimestamp(session?.endedAt)
    ?? (String(session?.status || '') === 'closed' ? toTimestamp(session?.lastMessageAt) : null);

  return {
    waitTimeMs: createdAt != null && assignedAt != null ? Math.max(0, assignedAt - createdAt) : null,
    firstResponseTimeMs: assignedAt != null && firstResponseAt != null
      ? Math.max(0, firstResponseAt - assignedAt)
      : null,
    handleTimeMs: assignedAt != null && endedAt != null ? Math.max(0, endedAt - assignedAt) : null,
  };
}

module.exports = {
  computeSessionTimingFields,
};
