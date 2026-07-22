'use strict';

/**
 * Soft-fail audit middleware for settings-related mutating routes.
 * Records successful POST/PUT/PATCH/DELETE responses to SettingsAuditLog.
 */

const {
  writeSettingsAuditFromRequest,
  actionFromHttpMethod
} = require('../services/settingsAuditService');
const { SETTINGS_AUDIT_SKIP_PATH_SUBSTRINGS } = require('../constants/settingsAuditConstants');
const {
  buildChangeList,
  buildHumanSummary,
  inferInvokePhrase,
  getActionLabel
} = require('../utils/settingsAuditHumanize');

/**
 * Limit snapshots to keys the client actually sent (supports nested plain objects).
 * @param {unknown} snapshot
 * @param {unknown} body
 * @returns {unknown}
 */
function scopeSnapshotToBody(snapshot, body) {
  if (snapshot == null || body == null || typeof body !== 'object' || Array.isArray(body)) {
    return snapshot;
  }
  if (typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return snapshot;
  }
  const out = {};
  for (const [key, bodyVal] of Object.entries(body)) {
    const snapVal = snapshot[key];
    if (
      bodyVal != null &&
      typeof bodyVal === 'object' &&
      !Array.isArray(bodyVal) &&
      snapVal != null &&
      typeof snapVal === 'object' &&
      !Array.isArray(snapVal)
    ) {
      out[key] = scopeSnapshotToBody(snapVal, bodyVal);
    } else {
      out[key] = snapVal !== undefined ? snapVal : null;
    }
  }
  return out;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * @param {string} path
 * @returns {boolean}
 */
function shouldSkipPath(path) {
  const normalized = String(path || '').toLowerCase();
  return SETTINGS_AUDIT_SKIP_PATH_SUBSTRINGS.some((fragment) =>
    normalized.includes(fragment)
  );
}

/**
 * Refine action for non-CRUD verbs (enable/disable/test/install…).
 * @param {string} method
 * @param {string} path
 * @returns {'create'|'update'|'delete'|'invoke'}
 */
function resolveAction(method, path) {
  const p = String(path || '').toLowerCase();
  if (
    /\/(enable|disable|install|uninstall|archive|test|toggle|migrate|recalculate|extend|purchase|replay|rotate|run-now|duplicate|suspend|reactivate|allocate|verify|register)/.test(
      p
    )
  ) {
    return 'invoke';
  }
  return actionFromHttpMethod(method);
}

/**
 * Infer surface from /api/settings/* paths.
 * @param {string} path
 * @returns {string}
 */
function resolveSettingsApiSurface(path) {
  const p = String(path || '').toLowerCase();
  if (p.includes('/security')) return 'security';
  if (p.includes('/organization')) return 'organization';
  if (p.includes('/integrations')) return 'integrations';
  if (p.includes('/addons')) return 'addons';
  if (p.includes('/applications') || p.includes('/quotes')) return 'applications';
  if (p.includes('/automation')) return 'automation';
  if (p.includes('/core-modules')) return 'modules';
  if (p.includes('/email-policy') || p.includes('/email/')) return 'email-policy';
  if (p.includes('/subscriptions')) return 'subscriptions';
  return 'settings';
}

/**
 * @param {object} [options]
 * @param {string} [options.surface]
 * @param {(req: import('express').Request) => string} [options.surfaceResolver]
 * @param {string} [options.entityType]
 * @returns {import('express').RequestHandler}
 */
function createSettingsAuditMiddleware(options = {}) {
  const defaultSurface = options.surface || 'settings';
  const surfaceResolver = options.surfaceResolver || null;
  const defaultEntityType = options.entityType || null;

  return function settingsAuditMiddleware(req, res, next) {
    if (!MUTATING_METHODS.has(String(req.method || '').toUpperCase())) {
      return next();
    }

    const path = req.originalUrl || req.path || '';
    if (shouldSkipPath(path)) {
      return next();
    }

    const originalJson = res.json.bind(res);
    res.json = function auditedJson(body) {
      try {
        const statusCode = res.statusCode || 200;
        const successFlag = body && typeof body === 'object' ? body.success : undefined;
        const ok = statusCode < 400 && successFlag !== false;

        if (ok && !res.locals.settingsAuditWritten) {
          res.locals.settingsAuditWritten = true;
          const surface =
            (typeof surfaceResolver === 'function' && surfaceResolver(req)) ||
            defaultSurface;
          const action = resolveAction(req.method, path);
          let before =
            res.locals.settingsAuditBefore !== undefined
              ? res.locals.settingsAuditBefore
              : null;
          let after =
            res.locals.settingsAuditAfter !== undefined
              ? res.locals.settingsAuditAfter
              : body && typeof body === 'object' && body.data && typeof body.data === 'object'
                ? body.data
                : null;

  // Scope to request body keys so partial (dirty-only) saves audit only those fields.
          // Skip when controller already attached a prepared field-level snapshot under `fields`
          // (array body vs keyed audit object would otherwise still be fine, but body-null padding
          // can drown real diffs for large module payloads).
          const requestBody =
            req.body && typeof req.body === 'object' && !Array.isArray(req.body)
              ? req.body
              : null;
          const hasPreparedModuleAudit =
            before &&
            after &&
            typeof before === 'object' &&
            typeof after === 'object' &&
            (
              (before.fields != null &&
                after.fields != null &&
                !Array.isArray(before.fields) &&
                !Array.isArray(after.fields)) ||
              (before.pipelineSettings != null && after.pipelineSettings != null) ||
              (before.relationships != null && after.relationships != null)
            );
          if (
            !hasPreparedModuleAudit &&
            before &&
            after &&
            requestBody &&
            Object.keys(requestBody).length > 0
          ) {
            before = scopeSnapshotToBody(before, requestBody);
            after = scopeSnapshotToBody(after, requestBody);
          } else if (!after && requestBody && Object.keys(requestBody).length > 0) {
            after = requestBody;
          }

          let changes = buildChangeList(before, after, { surface });

          // Creates with no before snapshot: treat as null → new values for sent fields.
          if (
            changes.length === 0 &&
            action === 'create' &&
            requestBody &&
            Object.keys(requestBody).length > 0
          ) {
            const created =
              after && typeof after === 'object' && !Array.isArray(after)
                ? after
                : requestBody;
            before = scopeSnapshotToBody({}, requestBody);
            after = scopeSnapshotToBody(created, requestBody);
            changes = buildChangeList(before, after, { surface });
          }

          // Enable/disable/install/delete with no field diffs: still show a clear operation row.
          if (changes.length === 0 && (action === 'invoke' || action === 'delete')) {
            const opLabel = inferInvokePhrase(path) || getActionLabel(action);
            changes = [
              {
                field: 'operation',
                label: 'Operation',
                from: action === 'delete' ? 'Present' : '—',
                to: opLabel,
                fromRaw: null,
                toRaw: opLabel
              }
            ];
          }

          // When a before snapshot was provided and nothing differed, skip the row.
          if (
            res.locals.settingsAuditBefore !== undefined &&
            changes.length === 0 &&
            action === 'update'
          ) {
            return originalJson(body);
          }

          // Skip empty update rows that never had a before snapshot (nothing useful to show).
          if (changes.length === 0 && action === 'update') {
            return originalJson(body);
          }

          const summary = buildHumanSummary({
            surface,
            action,
            path,
            before,
            after,
            changes
          });

          const moduleKey =
            (before && typeof before === 'object' && (before.moduleKey || before.key)) ||
            (after && typeof after === 'object' && (after.moduleKey || after.key)) ||
            (typeof req.params?.key === 'string' ? req.params.key : null) ||
            null;

          void writeSettingsAuditFromRequest(req, {
            surface,
            entityType: defaultEntityType,
            action,
            statusCode,
            summary,
            before,
            after,
            metadata: {
              path: String(path || '').slice(0, 300),
              moduleKey: moduleKey ? String(moduleKey).toLowerCase() : null,
              responseMessage:
                body && typeof body === 'object' && body.message
                  ? String(body.message).slice(0, 200)
                  : null,
              changes: changes.slice(0, 40).map((c) => ({
                field: c.field,
                label: c.label,
                from: c.from,
                to: c.to
              }))
            }
          });
        }
      } catch (err) {
        console.error('[settingsAuditMiddleware] unexpected error:', err.message);
      }
      return originalJson(body);
    };

    return next();
  };
}

module.exports = {
  createSettingsAuditMiddleware,
  shouldSkipPath,
  resolveAction,
  resolveSettingsApiSurface,
  scopeSnapshotToBody
};
