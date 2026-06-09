const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const { buildOrganizationListMongoQuery } = require('./organizationsListQuery');

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolve sales organization IDs whose name matches a text pattern (tenant-scoped).
 * @param {import('mongoose').Types.ObjectId|string} tenantOrganizationId
 * @param {string} searchText
 * @param {object} [user]
 * @returns {Promise<import('mongoose').Types.ObjectId[]>}
 */
async function resolveSalesOrganizationIdsForNameFilter(tenantOrganizationId, searchText, user) {
  const trimmed = String(searchText || '').trim();
  if (!trimmed) return [];

  const orgQuery = await buildOrganizationListMongoQuery({
    tenantOrganizationId,
    params: { name: trimmed },
    user,
    appKey: 'SALES',
  });

  const orgs = await Organization.find(orgQuery).select('_id').lean();
  return orgs.map((org) => org._id);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Replace invalid people.organization clauses (raw strings, regex) with resolved org ID sets.
 * @param {object} query
 * @param {{ tenantOrganizationId: import('mongoose').Types.ObjectId|string, user?: object }} context
 */
async function resolvePeopleOrganizationFilters(query, context) {
  if (!query || !isPlainObject(query)) return query;

  const { tenantOrganizationId, user } = context;
  const next = { ...query };

  if (next.organization instanceof RegExp) {
    const ids = await resolveSalesOrganizationIdsForNameFilter(
      tenantOrganizationId,
      next.organization.source,
      user
    );
    next.organization = ids.length > 0 ? { $in: ids } : { $in: [] };
  } else if (
    isPlainObject(next.organization)
    && next.organization.$not instanceof RegExp
  ) {
    const ids = await resolveSalesOrganizationIdsForNameFilter(
      tenantOrganizationId,
      next.organization.$not.source,
      user
    );
    delete next.organization;
    return {
      ...next,
      $or: [
        { organization: null },
        { organization: { $exists: false } },
        { organization: { $nin: ids } },
      ],
    };
  } else if (
    typeof next.organization === 'string'
    && !mongoose.Types.ObjectId.isValid(next.organization)
  ) {
    const ids = await resolveSalesOrganizationIdsForNameFilter(
      tenantOrganizationId,
      next.organization,
      user
    );
    next.organization = ids.length > 0 ? { $in: ids } : { $in: [] };
  }

  for (const key of ['$and', '$or']) {
    if (!Array.isArray(next[key])) continue;
    next[key] = await Promise.all(
      next[key].map((clause) => resolvePeopleOrganizationFilters(clause, context))
    );
  }

  return next;
}

module.exports = {
  resolveSalesOrganizationIdsForNameFilter,
  resolvePeopleOrganizationFilters,
};
