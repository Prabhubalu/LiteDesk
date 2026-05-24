/**
 * Semantic API error codes — stable across versions.
 * Client maps codes to localized ICU messages; never display raw server strings when code is set.
 * @see client/src/locales/en/errors.json
 */

const ERROR_CODES = Object.freeze({
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  ORG_NOT_FOUND: 'ORG_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',
});

/**
 * @param {string} code
 * @param {object} [options]
 * @param {string} [options.message] - English diagnostic (logs only when client maps code)
 * @param {Record<string, unknown>} [options.params] - ICU interpolation params for client
 */
function apiErrorPayload(code, options = {}) {
  return {
    success: false,
    code,
    message: options.message || code,
    params: options.params || undefined,
  };
}

module.exports = {
  ERROR_CODES,
  apiErrorPayload,
};
