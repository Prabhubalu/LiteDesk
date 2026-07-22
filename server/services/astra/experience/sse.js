'use strict';

/**
 * sse — minimal Server-Sent Events helpers for streaming Astra turns.
 * Framework-agnostic: takes an Express-style response with writeHead/write/end.
 */

/** Initialize an SSE stream on the response. */
function openStream(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  return res;
}

/** Emit a named event with a JSON payload. */
function sendEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data ?? {})}\n\n`);
}

/** Emit a token/delta chunk. */
function sendDelta(res, text) {
  sendEvent(res, 'delta', { text: String(text || '') });
}

/** Emit the final answer + metadata and close the stream. */
function closeStream(res, payload) {
  sendEvent(res, 'done', payload ?? {});
  res.end();
}

/** Emit an error event and close the stream. */
function failStream(res, error) {
  sendEvent(res, 'error', {
    code: error?.code || 'ASTRA_STREAM_ERROR',
    message: error?.message || 'Astra stream failed',
  });
  res.end();
}

module.exports = {
  openStream,
  sendEvent,
  sendDelta,
  closeStream,
  failStream,
};
