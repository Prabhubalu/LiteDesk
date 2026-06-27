'use strict';

const AppointmentBookingPublicRegistry = require('../models/AppointmentBookingPublicRegistry');

async function upsertPublicRegistryEntry({ slug, organizationId, bookingConfigId }) {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized || !organizationId || !bookingConfigId) {
    throw new Error('slug, organizationId, and bookingConfigId are required');
  }

  return AppointmentBookingPublicRegistry.findOneAndUpdate(
    { slug: normalized },
    {
      slug: normalized,
      organizationId,
      bookingConfigId,
      enabled: true
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function disablePublicRegistryEntry(slug) {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return null;
  return AppointmentBookingPublicRegistry.findOneAndUpdate(
    { slug: normalized },
    { $set: { enabled: false } },
    { new: true }
  );
}

async function removePublicRegistryEntry(slug) {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return null;
  return AppointmentBookingPublicRegistry.deleteOne({ slug: normalized });
}

async function findPublicRegistryEntry(slug) {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return null;
  return AppointmentBookingPublicRegistry.findOne({ slug: normalized, enabled: true }).lean();
}

/**
 * Keep master registry aligned with a saved booking config.
 * @param {object} config - mongoose doc or lean object
 * @param {{ previousSlug?: string }} [options]
 */
async function syncBookingPublicRegistry(config, options = {}) {
  const lean = config?.toObject ? config.toObject() : config;
  if (!lean?._id || !lean.organizationId) return;

  const previousSlug = options.previousSlug
    ? String(options.previousSlug).trim().toLowerCase()
    : null;
  const slug = String(lean.slug || '').trim().toLowerCase();

  if (previousSlug && previousSlug !== slug) {
    await removePublicRegistryEntry(previousSlug);
  }

  if (!slug) return;

  if (lean.enabled) {
    await upsertPublicRegistryEntry({
      slug,
      organizationId: lean.organizationId,
      bookingConfigId: lean._id
    });
  } else {
    await disablePublicRegistryEntry(slug);
  }
}

module.exports = {
  upsertPublicRegistryEntry,
  disablePublicRegistryEntry,
  removePublicRegistryEntry,
  findPublicRegistryEntry,
  syncBookingPublicRegistry
};
