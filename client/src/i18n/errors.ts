/**
 * Client-side semantic error catalog.
 * Server returns stable `code`; client owns all localized copy.
 * @see server/constants/errorCodes.js
 */

import type { FlatMessages } from './catalog';

/** Mirrors server ERROR_CODES — keep in sync when adding API errors. */
export const ERROR_CODES = {
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
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ERROR_I18N_PREFIX = 'errors';

export function errorCodeToKey(code: string): string {
  const normalized = code.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  return `${ERROR_I18N_PREFIX}.${normalized}`;
}

/**
 * Resolve localized API error message from response payload.
 * Never pass through raw server `message` for display when `code` is present.
 */
export function resolveApiErrorMessage(
  t: (key: string, params?: Record<string, unknown>) => string,
  payload: { code?: string; message?: string; params?: Record<string, unknown> } | null | undefined
): string {
  if (!payload) {
    return t(`${ERROR_I18N_PREFIX}.server_error`);
  }

  if (payload.code) {
    const key = errorCodeToKey(payload.code);
    const translated = t(key, payload.params ?? {});
    if (translated !== key) {
      return translated;
    }
  }

  if (import.meta.env.DEV && payload.message) {
    return payload.message;
  }

  return t(`${ERROR_I18N_PREFIX}.server_error`);
}

export const ERROR_CODE_KEYS: ErrorCode[] = Object.values(ERROR_CODES);

export function buildErrorMessagesFromCatalog(entries: FlatMessages): FlatMessages {
  return entries;
}
