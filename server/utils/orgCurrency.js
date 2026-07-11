'use strict';

const Organization = require('../models/Organization');

const PLATFORM_DEFAULT_CURRENCY = 'USD';

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeCurrencyCode(value) {
  if (value == null || value === '') return null;
  const code = String(value).trim().toUpperCase();
  return code || null;
}

/**
 * Resolve tenant org default currency from an org document/lean object.
 * @param {{ settings?: { currency?: string }, currency?: string }|null|undefined} org
 * @returns {string}
 */
function resolveOrgCurrencyCode(org) {
  const fromSettings = org?.settings?.currency ?? org?.currency;
  return normalizeCurrencyCode(fromSettings) || PLATFORM_DEFAULT_CURRENCY;
}

/**
 * Load tenant org currency for the given organizationId.
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @returns {Promise<string>}
 */
async function getTenantCurrencyCode(organizationId) {
  if (!organizationId) return PLATFORM_DEFAULT_CURRENCY;
  try {
    const tenantOrg = await Organization.findById(organizationId)
      .select('settings.currency')
      .lean();
    return resolveOrgCurrencyCode(tenantOrg);
  } catch (_) {
    return PLATFORM_DEFAULT_CURRENCY;
  }
}

/**
 * Apply org default when payload currency is missing/blank.
 * @param {string|null|undefined} currency
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @returns {Promise<string>}
 */
async function resolveCurrencyOrOrgDefault(currency, organizationId) {
  const normalized = normalizeCurrencyCode(currency);
  if (normalized) return normalized;
  return getTenantCurrencyCode(organizationId);
}

module.exports = {
  PLATFORM_DEFAULT_CURRENCY,
  normalizeCurrencyCode,
  resolveOrgCurrencyCode,
  getTenantCurrencyCode,
  resolveCurrencyOrOrgDefault,
};
