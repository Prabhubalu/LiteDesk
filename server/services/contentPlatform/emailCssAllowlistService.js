'use strict';

const Organization = require('../../models/Organization');
const {
  ContentPlatformError,
  CONTENT_PLATFORM_ERROR_CODES
} = require('../../utils/contentPlatformErrors');
const { normalizeCssAllowlist } = require('./emailExternalCssService');

const MAX_ALLOWLIST_ENTRIES = 50;
const MAX_HOST_LENGTH = 253;

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeAllowlistInput(value) {
  const normalized = normalizeCssAllowlist(value);
  if (normalized.length > MAX_ALLOWLIST_ENTRIES) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.VALIDATION_FAILED,
      `CSS allowlist exceeds ${MAX_ALLOWLIST_ENTRIES} entries`,
      { statusCode: 400 }
    );
  }

  for (const host of normalized) {
    if (host.length > MAX_HOST_LENGTH || !/^[a-z0-9.-]+$/.test(host)) {
      throw new ContentPlatformError(
        CONTENT_PLATFORM_ERROR_CODES.VALIDATION_FAILED,
        `Invalid hostname in allowlist: ${host}`,
        { statusCode: 400 }
      );
    }
  }

  return normalized;
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @returns {Promise<string[]>}
 */
async function getOrgEmailExternalCssAllowlist(organizationId) {
  const org = await Organization.findById(organizationId)
    .select('emailExternalCssAllowlist')
    .lean();

  if (!org) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Organization not found',
      { statusCode: 404 }
    );
  }

  return normalizeCssAllowlist(org.emailExternalCssAllowlist || []);
}

/**
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId|string} params.organizationId
 * @param {string[]} params.allowlist
 * @returns {Promise<string[]>}
 */
async function saveOrgEmailExternalCssAllowlist(params) {
  const { organizationId, allowlist } = params;
  const normalized = normalizeAllowlistInput(allowlist);

  const org = await Organization.findById(organizationId).select('emailExternalCssAllowlist');
  if (!org) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Organization not found',
      { statusCode: 404 }
    );
  }

  org.emailExternalCssAllowlist = normalized;
  await org.save();

  return normalized;
}

module.exports = {
  getOrgEmailExternalCssAllowlist,
  saveOrgEmailExternalCssAllowlist,
  normalizeAllowlistInput
};
