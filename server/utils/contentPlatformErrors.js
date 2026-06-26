'use strict';

const crypto = require('crypto');

const CONTENT_PLATFORM_ERROR_CODES = Object.freeze({
  VALIDATION_FAILED: 'CONTENT_VALIDATION_FAILED',
  NOT_FOUND: 'CONTENT_NOT_FOUND',
  FORBIDDEN: 'CONTENT_FORBIDDEN',
  CONFLICT: 'CONTENT_CONFLICT',
  PUBLISH_BLOCKED: 'CONTENT_PUBLISH_BLOCKED',
  RENDER_NOT_IMPLEMENTED: 'CONTENT_RENDER_NOT_IMPLEMENTED',
  INVALID_COMPONENT: 'CONTENT_INVALID_COMPONENT',
  UNKNOWN: 'CONTENT_UNKNOWN'
});

class ContentPlatformError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {{ statusCode?: number, details?: unknown[], cause?: Error }} [options]
   */
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'ContentPlatformError';
    this.code = code;
    this.statusCode = options.statusCode || 400;
    this.details = Array.isArray(options.details) ? options.details : [];
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

function createTraceId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}

/**
 * @param {import('express').Response} res
 * @param {unknown} error
 * @param {string} [fallbackMessage]
 */
function sendContentPlatformError(res, error, fallbackMessage = 'Request failed') {
  const traceId = createTraceId();
  const statusCode = error instanceof ContentPlatformError ? error.statusCode : 500;
  const code = error instanceof ContentPlatformError
    ? error.code
    : CONTENT_PLATFORM_ERROR_CODES.UNKNOWN;
  const message = error instanceof Error ? error.message : fallbackMessage;
  const details = error instanceof ContentPlatformError ? error.details : [];

  if (!(error instanceof ContentPlatformError)) {
    console.error('[contentPlatform]', traceId, error);
  }

  return res.status(statusCode).json({
    success: false,
    code,
    message,
    details,
    traceId
  });
}

module.exports = {
  CONTENT_PLATFORM_ERROR_CODES,
  ContentPlatformError,
  createTraceId,
  sendContentPlatformError
};
