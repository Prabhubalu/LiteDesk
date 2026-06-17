'use strict';

const Webform = require('../models/Webform');
const Organization = require('../models/Organization');
const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
const { findPublicRegistryEntry, upsertPublicRegistryEntry } = require('./webformPublicRegistryService');

function isPublicWebformReady(webform, slug, options) {
  if (!webform) return false;
  const normalized = String(slug).trim().toLowerCase();
  const statusOk = options.allowDraft
    ? ['Active', 'Draft'].includes(webform.status)
    : webform.status === 'Active';
  return (
    statusOk
    && webform.publicLink?.enabled === true
    && String(webform.publicLink?.slug || '').toLowerCase() === normalized
  );
}

async function findViaRegistry(slug, options) {
  const entry = await findPublicRegistryEntry(slug);
  if (!entry) return null;

  return runWithOrganizationTenantContext(entry.organizationId, async () => {
    const webform = await Webform.findOne({
      _id: entry.webformId,
      organizationId: entry.organizationId
    });
    return isPublicWebformReady(webform, slug, options) ? webform : null;
  });
}

async function scanTenantDatabases(slug, options) {
  const orgs = await Organization.find({
    'database.initialized': true,
    'database.name': { $exists: true, $ne: '' }
  })
    .select('_id')
    .lean();

  const batchSize = 8;
  for (let index = 0; index < orgs.length; index += batchSize) {
    const batch = orgs.slice(index, index + batchSize);
    // eslint-disable-next-line no-await-in-loop
    const matches = await Promise.all(
      batch.map((org) =>
        runWithOrganizationTenantContext(org._id, () => findInCurrentContext(slug, options))
      )
    );
    const webform = matches.find(Boolean);
    if (webform) {
      try {
        await upsertPublicRegistryEntry({
          slug,
          organizationId: webform.organizationId,
          webformId: webform._id
        });
      } catch (registryErr) {
        console.warn('[webformPublicService] registry upsert failed:', registryErr?.message || registryErr);
      }
      return webform;
    }
  }

  return null;
}

function buildPublicSlugQuery(slug, { allowDraft = false } = {}) {
  return {
    'publicLink.slug': String(slug).trim().toLowerCase(),
    'publicLink.enabled': true,
    status: allowDraft ? { $in: ['Active', 'Draft'] } : 'Active'
  };
}

async function findInCurrentContext(slug, options) {
  return Webform.findOne(buildPublicSlugQuery(slug, options));
}

/**
 * Resolve a published webform by public slug across master registry and tenant databases.
 * @param {string} slug
 * @param {{ allowDraft?: boolean, scanTenants?: boolean }} [options]
 */
async function findPublicWebformBySlug(slug, options = {}) {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return null;

  const scanTenants = options.scanTenants === true;

  let webform = await findViaRegistry(normalized, options);
  if (webform) return webform;

  webform = await findInCurrentContext(normalized, options);
  if (webform) {
    try {
      await upsertPublicRegistryEntry({
        slug: normalized,
        organizationId: webform.organizationId,
        webformId: webform._id
      });
    } catch (registryErr) {
      console.warn('[webformPublicService] registry upsert failed:', registryErr?.message || registryErr);
    }
    return webform;
  }

  if (!scanTenants) return null;

  return scanTenantDatabases(normalized, options);
}

async function withPublicWebformTenantContext(webform, fn) {
  if (!webform?.organizationId) {
    throw new Error('Webform organizationId is required');
  }
  return runWithOrganizationTenantContext(webform.organizationId, fn);
}

module.exports = {
  findPublicWebformBySlug,
  withPublicWebformTenantContext
};
