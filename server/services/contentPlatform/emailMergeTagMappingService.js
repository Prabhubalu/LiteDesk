'use strict';

const Organization = require('../../models/Organization');
const {
  ContentPlatformError,
  CONTENT_PLATFORM_ERROR_CODES
} = require('../../utils/contentPlatformErrors');

const MAX_MAPPINGS = 500;
const MAX_RAW_KEY_LENGTH = 200;
const MAX_PATH_LENGTH = 200;

/**
 * @param {unknown} value
 * @returns {Record<string, { path?: string, skip?: boolean }>}
 */
function normalizeMergeMappings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const output = {};
  for (const [raw, mapping] of Object.entries(value)) {
    const key = String(raw || '').trim();
    if (!key || key.length > MAX_RAW_KEY_LENGTH) continue;
    if (!mapping || typeof mapping !== 'object') continue;

    if (mapping.skip === true) {
      output[key] = { skip: true };
      continue;
    }

    const path = String(mapping.path || '').trim();
    if (!path || path.length > MAX_PATH_LENGTH) continue;
    output[key] = { path, skip: false };
  }

  const keys = Object.keys(output);
  if (keys.length > MAX_MAPPINGS) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.VALIDATION_FAILED,
      `Merge mappings exceed ${MAX_MAPPINGS} entries`,
      { statusCode: 400 }
    );
  }

  return output;
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @returns {Promise<Record<string, { path?: string, skip?: boolean }>>}
 */
async function getOrgEmailMergeTagMappings(organizationId) {
  const org = await Organization.findById(organizationId)
    .select('emailMergeTagMappings')
    .lean();

  if (!org) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Organization not found',
      { statusCode: 404 }
    );
  }

  return normalizeMergeMappings(org.emailMergeTagMappings || {});
}

/**
 * Merge incoming mappings into org storage (upsert by raw tag key).
 *
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId|string} params.organizationId
 * @param {Record<string, { path?: string, skip?: boolean }>} params.mappings
 * @returns {Promise<Record<string, { path?: string, skip?: boolean }>>}
 */
async function saveOrgEmailMergeTagMappings(params) {
  const { organizationId, mappings, replace = false } = params;
  const incoming = normalizeMergeMappings(mappings);

  const org = await Organization.findById(organizationId).select('emailMergeTagMappings');
  if (!org) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Organization not found',
      { statusCode: 404 }
    );
  }

  const normalized = replace
    ? incoming
    : normalizeMergeMappings({
      ...normalizeMergeMappings(org.emailMergeTagMappings || {}),
      ...incoming
    });

  org.emailMergeTagMappings = normalized;
  await org.save();

  return normalized;
}

module.exports = {
  normalizeMergeMappings,
  getOrgEmailMergeTagMappings,
  saveOrgEmailMergeTagMappings
};
