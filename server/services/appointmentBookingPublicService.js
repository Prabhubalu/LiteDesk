'use strict';

const Organization = require('../models/Organization');
const AppointmentBookingConfig = require('../models/AppointmentBookingConfig');
const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
const {
  findPublicRegistryEntry,
  upsertPublicRegistryEntry
} = require('./appointmentBookingPublicRegistryService');

function isPublicBookingConfigReady(config, slug) {
  if (!config) return false;
  const normalized = String(slug).trim().toLowerCase();
  return config.enabled === true && String(config.slug || '').toLowerCase() === normalized;
}

async function findInCurrentContext(slug) {
  return AppointmentBookingConfig.findOne({
    slug: String(slug).trim().toLowerCase(),
    enabled: true
  });
}

async function findViaRegistry(slug) {
  const entry = await findPublicRegistryEntry(slug);
  if (!entry) return null;

  return runWithOrganizationTenantContext(entry.organizationId, async () => {
    const config = await AppointmentBookingConfig.findOne({
      _id: entry.bookingConfigId,
      organizationId: entry.organizationId
    });
    return isPublicBookingConfigReady(config, slug) ? config : null;
  });
}

async function scanTenantDatabases(slug) {
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
        runWithOrganizationTenantContext(org._id, () => findInCurrentContext(slug))
      )
    );
    const config = matches.find(Boolean);
    if (config) {
      try {
        await upsertPublicRegistryEntry({
          slug,
          organizationId: config.organizationId,
          bookingConfigId: config._id
        });
      } catch (registryErr) {
        console.warn('[appointmentBookingPublicService] registry upsert failed:', registryErr?.message || registryErr);
      }
      return config;
    }
  }

  return null;
}

/**
 * Resolve an enabled booking config by public slug across master registry and tenant databases.
 * @param {string} slug
 * @param {{ scanTenants?: boolean }} [options]
 */
async function findPublicBookingConfigBySlug(slug, options = {}) {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return null;

  const scanTenants = options.scanTenants !== false;

  let config = await findViaRegistry(normalized);
  if (config) return config;

  config = await findInCurrentContext(normalized);
  if (config) {
    try {
      await upsertPublicRegistryEntry({
        slug: normalized,
        organizationId: config.organizationId,
        bookingConfigId: config._id
      });
    } catch (registryErr) {
      console.warn('[appointmentBookingPublicService] registry upsert failed:', registryErr?.message || registryErr);
    }
    return config;
  }

  if (!scanTenants) return null;

  return scanTenantDatabases(normalized);
}

async function withPublicBookingTenantContext(config, fn) {
  if (!config?.organizationId) {
    throw new Error('Booking config organizationId is required');
  }
  return runWithOrganizationTenantContext(config.organizationId, fn);
}

module.exports = {
  findPublicBookingConfigBySlug,
  withPublicBookingTenantContext
};
