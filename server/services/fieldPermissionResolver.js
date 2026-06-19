/**
 * RBAC v2 field permission resolver.
 * Tri-state: hidden | read | write (absence = no extra restriction).
 *
 * Key format: `${appKey}.${moduleKey}.${fieldKey}` (e.g. SALES.deals.amount)
 * Fallback keys: `_CORE.${moduleKey}.${fieldKey}`, `${moduleKey}.${fieldKey}`
 */

const { isRbacV2Enabled } = require('../utils/rbacFeatureFlags');

const FIELD_STATES = new Set(['hidden', 'read', 'write']);

function normalizeModuleKey(moduleKey) {
  const k = String(moduleKey || '').toLowerCase();
  if (k === 'contacts') return 'people';
  return k;
}

function normalizeAppKey(appKey) {
  if (!appKey) return null;
  return String(appKey).toUpperCase();
}

/**
 * @param {string|null} appKey
 * @param {string} moduleKey
 * @param {string} fieldKey
 */
function buildFieldPermissionKey(appKey, moduleKey, fieldKey) {
  const mod = normalizeModuleKey(moduleKey);
  const field = String(fieldKey || '').trim();
  const app = normalizeAppKey(appKey) || '_CORE';
  return `${app}.${mod}.${field}`;
}

function toPlainFieldPermissions(value) {
  if (!value) return {};
  if (typeof value.entries === 'function') {
    const out = {};
    for (const [k, v] of value.entries()) {
      if (FIELD_STATES.has(v)) out[k] = v;
    }
    return out;
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (FIELD_STATES.has(v)) out[k] = v;
    }
    return out;
  }
  return {};
}

function lookupFieldPermission(map, appKey, moduleKey, fieldKey) {
  if (!map || typeof map !== 'object') return null;
  const mod = normalizeModuleKey(moduleKey);
  const field = String(fieldKey || '').trim();
  if (!field) return null;

  const candidates = [];
  const app = normalizeAppKey(appKey);
  if (app) candidates.push(`${app}.${mod}.${field}`);
  candidates.push(`_CORE.${mod}.${field}`);
  candidates.push(`${mod}.${field}`);

  for (const key of candidates) {
    const state = map[key];
    if (FIELD_STATES.has(state)) return state;
  }
  return null;
}

function userBypassesFieldPermissions(user) {
  if (!user) return true;
  if (user.isOwner === true) return true;
  if (user._isTenantPrivileged === true) return true;
  return false;
}

/**
 * @param {object} user
 * @param {{ appKey?: string|null, moduleKey: string, fieldKey: string, organization?: object|null }} params
 * @returns {'hidden'|'read'|'write'|null}
 */
function resolveFieldPermission(user, params = {}) {
  const { appKey = null, moduleKey, fieldKey, organization = null } = params;
  if (!user || !moduleKey || !fieldKey) return null;
  if (userBypassesFieldPermissions(user)) return 'write';

  const org = organization || user.organization || null;
  if (!isRbacV2Enabled(org) && !user.fieldPermissions) return null;

  const map = toPlainFieldPermissions(user.fieldPermissions);
  if (Object.keys(map).length === 0) return null;

  return lookupFieldPermission(map, appKey, moduleKey, fieldKey);
}

/**
 * @param {object} user
 * @param {{ appKey?: string|null, moduleKey: string, fieldKey: string, organization?: object|null }} params
 */
function isFieldHidden(user, params) {
  return resolveFieldPermission(user, params) === 'hidden';
}

/**
 * @param {object} user
 * @param {{ appKey?: string|null, moduleKey: string, fieldKey: string, organization?: object|null }} params
 */
function isFieldReadOnly(user, params) {
  const state = resolveFieldPermission(user, params);
  return state === 'read';
}

module.exports = {
  buildFieldPermissionKey,
  toPlainFieldPermissions,
  lookupFieldPermission,
  resolveFieldPermission,
  isFieldHidden,
  isFieldReadOnly,
  normalizeModuleKey
};
