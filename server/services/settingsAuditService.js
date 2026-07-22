'use strict';

/**
 * Append-only settings change audit writer (SettingsAuditLog collection).
 * Soft-fail: never throws into the settings request path.
 */

const SettingsAuditLog = require('../models/SettingsAuditLog');
const { SETTINGS_AUDIT_ACTIONS } = require('../constants/settingsAuditConstants');
const mongoose = require('mongoose');

const SECRET_KEY_RE =
  /(password|secret|token|api[_-]?key|private[_-]?key|authorization|credential|webhook[_-]?secret|access[_-]?key|refresh[_-]?token|byok)/i;

const MAX_JSON_DEPTH = 6;
const MAX_ARRAY_ITEMS = 50;
const MAX_STRING_LEN = 2000;

/**
 * Recursively redact secret-like keys and truncate large payloads.
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {unknown}
 */
function redactSensitive(value, depth = 0) {
  if (value == null) return value;
  if (depth > MAX_JSON_DEPTH) return '[truncated]';

  if (typeof value === 'string') {
    return value.length > MAX_STRING_LEN ? `${value.slice(0, MAX_STRING_LEN)}…` : value;
  }
  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    const sliced = value.slice(0, MAX_ARRAY_ITEMS).map((item) => redactSensitive(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) {
      sliced.push(`[+${value.length - MAX_ARRAY_ITEMS} more]`);
    }
    return sliced;
  }

  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (SECRET_KEY_RE.test(key)) {
      out[key] = raw == null || raw === '' ? raw : '[REDACTED]';
      continue;
    }
    out[key] = redactSensitive(raw, depth + 1);
  }
  return out;
}

/**
 * @param {string} method
 * @returns {'create'|'update'|'delete'|'invoke'}
 */
function actionFromHttpMethod(method) {
  const m = String(method || '').toUpperCase();
  if (m === 'POST') return 'create';
  if (m === 'DELETE') return 'delete';
  if (m === 'PUT' || m === 'PATCH') return 'update';
  return 'invoke';
}

/**
 * @param {unknown} value
 * @returns {import('mongoose').Types.ObjectId|null}
 */
function toObjectIdOrNull(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  const str = String(value);
  if (/^[a-fA-F0-9]{24}$/.test(str)) {
    return new mongoose.Types.ObjectId(str);
  }
  return null;
}

/**
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId|string} params.organizationId
 * @param {string} params.action
 * @param {string} params.surface
 * @param {import('mongoose').Types.ObjectId|string|null} [params.actorUserId]
 * @param {string|null} [params.actorName]
 * @param {string|null} [params.actorEmail]
 * @param {string|null} [params.entityType]
 * @param {import('mongoose').Types.ObjectId|string|null} [params.entityId]
 * @param {string} [params.summary]
 * @param {unknown} [params.before]
 * @param {unknown} [params.after]
 * @param {Record<string, unknown>} [params.metadata]
 * @param {string|null} [params.ipAddress]
 * @param {string|null} [params.userAgent]
 */
async function writeSettingsAuditLog(params) {
  const {
    organizationId,
    action,
    surface,
    actorUserId = null,
    actorName = null,
    actorEmail = null,
    entityType = null,
    entityId = null,
    summary = '',
    before = null,
    after = null,
    metadata = {},
    ipAddress = null,
    userAgent = null
  } = params || {};

  if (!organizationId || !action || !surface) {
    return null;
  }

  if (!SETTINGS_AUDIT_ACTIONS.includes(action)) {
    console.warn('[settingsAuditService] Unknown action:', action);
    return null;
  }

  try {
    return await SettingsAuditLog.create({
      organizationId,
      actorUserId: toObjectIdOrNull(actorUserId),
      actorName: actorName ? String(actorName).trim() : null,
      actorEmail: actorEmail ? String(actorEmail).trim().toLowerCase() : null,
      action,
      surface: String(surface).trim(),
      entityType: entityType ? String(entityType).trim() : null,
      entityId: toObjectIdOrNull(entityId),
      summary: String(summary || '').trim().slice(0, 500),
      before: before == null ? null : redactSensitive(before),
      after: after == null ? null : redactSensitive(after),
      metadata: metadata && typeof metadata === 'object' ? redactSensitive(metadata) : {},
      ipAddress: ipAddress ? String(ipAddress).slice(0, 128) : null,
      userAgent: userAgent ? String(userAgent).slice(0, 512) : null
    });
  } catch (err) {
    console.error('[settingsAuditService] writeSettingsAuditLog failed:', err.message);
    return null;
  }
}

/**
 * @param {import('express').Request} req
 * @param {object} [overrides]
 */
async function writeSettingsAuditFromRequest(req, overrides = {}) {
  const user = req?.user || {};
  const organizationId = user.organizationId || req?.organizationId;
  if (!organizationId) return null;

  const method = overrides.method || req.method;
  const path = overrides.path || req.originalUrl || req.path || '';
  const action = overrides.action || actionFromHttpMethod(method);
  const surface = overrides.surface || 'settings';

  const name =
    user.name ||
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    null;

  return writeSettingsAuditLog({
    organizationId,
    actorUserId: user._id || user.id || null,
    actorName: name,
    actorEmail: user.email || null,
    action,
    surface,
    entityType: overrides.entityType || null,
    entityId: overrides.entityId || req.params?.id || null,
    summary: overrides.summary || `${method} ${path}`.slice(0, 500),
    before: overrides.before ?? null,
    after: overrides.after !== undefined ? overrides.after : (req.body || null),
    metadata: {
      method,
      path,
      params: req.params || {},
      query: req.query || {},
      statusCode: overrides.statusCode || null,
      ...(overrides.metadata || {})
    },
    ipAddress: resolveClientIp(req),
    userAgent: typeof req.get === 'function' ? req.get('user-agent') : null
  });
}

/**
 * Prefer first public proxy hop; fall back to Express req.ip.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function resolveClientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim().slice(0, 128);
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).trim().slice(0, 128);
  }
  const ip = req?.ip || req?.socket?.remoteAddress || null;
  return ip ? String(ip).slice(0, 128) : null;
}

module.exports = {
  redactSensitive,
  actionFromHttpMethod,
  writeSettingsAuditLog,
  writeSettingsAuditFromRequest,
  resolveClientIp
};
