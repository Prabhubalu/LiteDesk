'use strict';

/**
 * Attach before/after audit snapshots, scoped to keys present in the request body
 * (or an explicit allowlist). Soft no-op if res is missing.
 *
 * @param {import('express').Response} res
 * @param {object|null} before
 * @param {object|null} after
 * @param {object} [options]
 * @param {string[]} [options.keys] - explicit keys; defaults to Object.keys(body)
 * @param {object} [options.body]
 */
function attachSettingsAuditDiff(res, before, after, options = {}) {
  if (!res || !res.locals) return;

  const body = options.body && typeof options.body === 'object' ? options.body : {};
  const keys = Array.isArray(options.keys) && options.keys.length
    ? options.keys
    : Object.keys(body);

  const pick = (source, keyList) => {
    if (!source || typeof source !== 'object') return null;
    if (!keyList.length) {
      return source;
    }
    const out = {};
    for (const key of keyList) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        out[key] = source[key];
      } else if (source[key] !== undefined) {
        out[key] = source[key];
      } else {
        out[key] = null;
      }
    }
    return out;
  };

  // Nested body (e.g. { settings: {...} }) — prefer leaf object when single wrapper key.
  let effectiveBefore = before;
  let effectiveAfter = after;
  let effectiveKeys = keys;

  if (
    keys.length === 1 &&
    keys[0] === 'settings' &&
    before &&
    after &&
    typeof before === 'object' &&
    typeof after === 'object'
  ) {
    effectiveBefore = before.settings != null ? before.settings : before;
    effectiveAfter = after.settings != null ? after.settings : after;
    effectiveKeys = Object.keys(body.settings || body);
  }

  res.locals.settingsAuditBefore =
    effectiveKeys.length > 0 ? pick(effectiveBefore, effectiveKeys) : effectiveBefore;
  res.locals.settingsAuditAfter =
    effectiveKeys.length > 0 ? pick(effectiveAfter, effectiveKeys) : effectiveAfter;
}

/**
 * Deep clone plain JSON-compatible values for audit snapshots.
 * @param {unknown} value
 * @returns {unknown}
 */
function cloneForAudit(value) {
  if (value == null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

/** Internal / noisy field keys excluded from settings audit field diffs. */
const MODULE_FIELD_AUDIT_DENY = new Set([
  '_id',
  '__v',
  'id',
  'key',
  'owner',
  'source',
  'origin',
  'locked',
  'system',
  'isSystem',
  'isPlatform',
  'platform',
  'appKey',
  'moduleKey',
  'organizationId',
  'createdAt',
  'updatedAt',
  'createdBy',
  'modifiedBy'
]);

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function auditValuesEqual(a, b) {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * @param {unknown} fields
 * @returns {Record<string, { displayKey: string, field: object }>}
 */
function indexModuleFieldsByKey(fields) {
  /** @type {Record<string, { displayKey: string, field: object }>} */
  const map = {};
  if (!Array.isArray(fields)) return map;
  for (const field of fields) {
    if (!field || typeof field !== 'object') continue;
    const key = String(field.key || '').trim();
    if (!key) continue;
    const lower = key.toLowerCase();
    // Prefer first exact casing; later duplicates ignored.
    if (!map[lower]) {
      map[lower] = { displayKey: key, field };
    }
  }
  return map;
}

/**
 * Pick every user-facing field config property (checkboxes, nested settings, options, …).
 * @param {object|null|undefined} field
 * @returns {Record<string, unknown>|null}
 */
function pickModuleFieldAuditProps(field) {
  if (!field || typeof field !== 'object') return null;
  const cloned = cloneForAudit(field);
  if (!cloned || typeof cloned !== 'object') return null;
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [prop, value] of Object.entries(cloned)) {
    if (MODULE_FIELD_AUDIT_DENY.has(prop)) continue;
    if (value === undefined) continue;
    out[prop] = value;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Index pipeline settings by pipeline key for property-level diffs.
 * @param {unknown} pipelines
 * @returns {Record<string, unknown>|null}
 */
function indexPipelinesForAudit(pipelines) {
  if (!Array.isArray(pipelines)) return null;
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const pipeline of pipelines) {
    if (!pipeline || typeof pipeline !== 'object') continue;
    const pKey = String(pipeline.key || pipeline.name || '').trim() || `pipeline_${Object.keys(out).length}`;
    const stagesIn = Array.isArray(pipeline.stages) ? pipeline.stages : [];
    /** @type {Record<string, unknown>} */
    const stages = {};
    for (const stage of stagesIn) {
      if (!stage || typeof stage !== 'object') continue;
      const sKey = String(stage.key || stage.name || '').trim() || `stage_${Object.keys(stages).length}`;
      const stageClone = cloneForAudit(stage) || {};
      if (stageClone && typeof stageClone === 'object') {
        delete stageClone.key;
        delete stageClone._id;
        delete stageClone.createdAt;
        delete stageClone.updatedAt;
      }
      stages[sKey] = stageClone;
    }
    const pipeClone = cloneForAudit(pipeline) || {};
    if (pipeClone && typeof pipeClone === 'object') {
      delete pipeClone.key;
      delete pipeClone._id;
      delete pipeClone.stages;
      delete pipeClone.createdAt;
      delete pipeClone.updatedAt;
    }
    out[pKey] = { ...(pipeClone || {}), stages };
  }
  return out;
}

/**
 * Index relationship list by a stable key for diffs.
 * @param {unknown} relationships
 * @returns {Record<string, unknown>|null}
 */
function indexRelationshipsForAudit(relationships) {
  if (!Array.isArray(relationships)) return null;
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const rel of relationships) {
    if (!rel || typeof rel !== 'object') continue;
    const rKey =
      String(rel.key || rel.name || `${rel.from || ''}->${rel.to || ''}` || '').trim() ||
      `rel_${Object.keys(out).length}`;
    out[rKey] = cloneForAudit(rel);
  }
  return out;
}

/**
 * Build before/after snapshots for module field-configuration saves.
 * Only includes fields/properties that actually changed (avoids noise + empty audits).
 *
 * @param {object} params
 * @param {object|null|undefined} params.beforeDoc
 * @param {object|null|undefined} params.afterDoc
 * @param {object|null|undefined} params.body
 * @returns {{ before: object, after: object }}
 */
function buildModuleSettingsAuditPair({ beforeDoc, afterDoc, body }) {
  const reqBody = body && typeof body === 'object' ? body : {};
  /** @type {Record<string, unknown>} */
  const before = {};
  /** @type {Record<string, unknown>} */
  const after = {};

  const moduleKey = afterDoc?.key || beforeDoc?.key || null;
  if (moduleKey) {
    before.moduleKey = moduleKey;
    after.moduleKey = moduleKey;
  }

  if (reqBody.name !== undefined || !auditValuesEqual(beforeDoc?.name, afterDoc?.name)) {
    before.name = beforeDoc?.name ?? null;
    after.name = afterDoc?.name ?? null;
  }
  if (reqBody.enabled !== undefined || !auditValuesEqual(beforeDoc?.enabled, afterDoc?.enabled)) {
    before.enabled = beforeDoc?.enabled ?? null;
    after.enabled = afterDoc?.enabled ?? null;
  }

  if (Array.isArray(reqBody.fields) || Array.isArray(afterDoc?.fields) || Array.isArray(beforeDoc?.fields)) {
    const beforeMap = indexModuleFieldsByKey(beforeDoc?.fields);
    const afterMap = indexModuleFieldsByKey(afterDoc?.fields);
    /** @type {Record<string, unknown>} */
    const fieldsBefore = {};
    /** @type {Record<string, unknown>} */
    const fieldsAfter = {};
    const keys = new Set([...Object.keys(beforeMap), ...Object.keys(afterMap)]);

    for (const fieldKeyLower of keys) {
      const beforeEntry = beforeMap[fieldKeyLower];
      const afterEntry = afterMap[fieldKeyLower];
      const displayKey = afterEntry?.displayKey || beforeEntry?.displayKey || fieldKeyLower;
      const beforeProps = pickModuleFieldAuditProps(beforeEntry?.field);
      const afterProps = pickModuleFieldAuditProps(afterEntry?.field);
      if (auditValuesEqual(beforeProps, afterProps)) continue;

      if (!beforeProps) {
        fieldsBefore[displayKey] = null;
        fieldsAfter[displayKey] = afterProps;
        continue;
      }
      if (!afterProps) {
        fieldsBefore[displayKey] = beforeProps;
        fieldsAfter[displayKey] = null;
        continue;
      }

      /** @type {Record<string, unknown>} */
      const changedBefore = {};
      /** @type {Record<string, unknown>} */
      const changedAfter = {};
      const propKeys = new Set([...Object.keys(beforeProps), ...Object.keys(afterProps)]);
      for (const prop of propKeys) {
        const fromVal = beforeProps[prop];
        const toVal = afterProps[prop];
        if (auditValuesEqual(fromVal, toVal)) continue;
        changedBefore[prop] = fromVal === undefined ? null : fromVal;
        changedAfter[prop] = toVal === undefined ? null : toVal;
      }
      if (Object.keys(changedBefore).length === 0 && Object.keys(changedAfter).length === 0) {
        continue;
      }
      fieldsBefore[displayKey] = changedBefore;
      fieldsAfter[displayKey] = changedAfter;
    }

    if (Object.keys(fieldsBefore).length > 0 || Object.keys(fieldsAfter).length > 0) {
      before.fields = fieldsBefore;
      after.fields = fieldsAfter;
    }
  }

  if (reqBody.quickCreate !== undefined) {
    before.quickCreate = Array.isArray(beforeDoc?.quickCreate) ? beforeDoc.quickCreate : [];
    after.quickCreate = Array.isArray(afterDoc?.quickCreate) ? afterDoc.quickCreate : [];
  }
  if (reqBody.quickCreateLayout !== undefined) {
    before.quickCreateLayout = beforeDoc?.quickCreateLayout ?? null;
    after.quickCreateLayout = afterDoc?.quickCreateLayout ?? null;
  }
  if (reqBody.relationships !== undefined) {
    before.relationships = indexRelationshipsForAudit(beforeDoc?.relationships) || {};
    after.relationships = indexRelationshipsForAudit(afterDoc?.relationships) || {};
  }
  if (reqBody.pipelineSettings !== undefined) {
    before.pipelineSettings = indexPipelinesForAudit(beforeDoc?.pipelineSettings) || {};
    after.pipelineSettings = indexPipelinesForAudit(afterDoc?.pipelineSettings) || {};
  }

  return { before: cloneForAudit(before), after: cloneForAudit(after) };
}

module.exports = {
  attachSettingsAuditDiff,
  cloneForAudit,
  buildModuleSettingsAuditPair
};
