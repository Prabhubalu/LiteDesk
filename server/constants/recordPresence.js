'use strict';

const PRESENCE_ACTIVITY_TYPES = new Set(['editing', 'viewing', 'idle']);

const PRESENCE_TTL_MS = Math.max(
  30_000,
  parseInt(process.env.RECORD_PRESENCE_TTL_MS || process.env.DOCUMENT_PRESENCE_TTL_MS || '45000', 10)
);

const PRESENCE_HEARTBEAT_MS = Math.max(
  10_000,
  parseInt(process.env.RECORD_PRESENCE_HEARTBEAT_MS || process.env.DOCUMENT_PRESENCE_HEARTBEAT_MS || '20000', 10)
);

module.exports = {
  PRESENCE_ACTIVITY_TYPES,
  PRESENCE_TTL_MS,
  PRESENCE_HEARTBEAT_MS
};
