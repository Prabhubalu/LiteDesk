'use strict';

const { legacyMetadataPrefix } = require('./legacyBrandSlug');

/** @deprecated AMDS/webhook metadata — prefer {@link readMetadata} / {@link writeMetadata}. */
const METADATA_PREFIX = 'arivu_';

/**
 * @param {Record<string, unknown>|null|undefined} metadata
 * @param {string} suffix e.g. org_id, module, communication_id
 * @returns {string|null}
 */
function readMetadata(metadata, suffix) {
  if (!metadata || typeof metadata !== 'object') return null;
  const primary = metadata[`${METADATA_PREFIX}${suffix}`];
  if (primary != null && String(primary).trim() !== '') {
    return String(primary).trim();
  }
  const legacy = metadata[`${legacyMetadataPrefix()}${suffix}`];
  if (legacy != null && String(legacy).trim() !== '') {
    return String(legacy).trim();
  }
  return null;
}

/**
 * Dual-write metadata for AMDS (arivu_* + pre-rebrand legacy keys).
 * @param {Record<string, string|number|null|undefined>} fields
 * @returns {Record<string, string>}
 */
function writeMetadata(fields) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [suffix, value] of Object.entries(fields)) {
    if (value == null || value === '') continue;
    const normalized = String(value);
    out[`${METADATA_PREFIX}${suffix}`] = normalized;
    out[`${legacyMetadataPrefix()}${suffix}`] = normalized;
  }
  return out;
}

/** @param {string} parts */
function buildIdempotencyKey(...parts) {
  return `arivu-${parts.filter(Boolean).join('-')}`.slice(0, 256);
}

module.exports = {
  METADATA_PREFIX,
  readMetadata,
  writeMetadata,
  buildIdempotencyKey
};
