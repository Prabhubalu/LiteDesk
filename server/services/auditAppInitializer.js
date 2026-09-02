'use strict';

/**
 * Initializes AUDIT app tenant configuration for an organization.
 */
async function initializeAudit(organizationId) {
  const TenantAppConfiguration = require('../models/TenantAppConfiguration');
  const TenantModuleConfiguration = require('../models/TenantModuleConfiguration');

  await TenantAppConfiguration.findOneAndUpdate(
    { organizationId, appKey: 'AUDIT' },
    {
      $set: {
        enabled: true,
        status: 'ACTIVE',
        enabledAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await TenantModuleConfiguration.findOneAndUpdate(
    { organizationId, appKey: 'AUDIT', moduleKey: 'assignments' },
    {
      $set: {
        enabled: true,
        labelOverride: 'Inspections',
        ui: { showInSidebar: true },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const salesAppInitializer = require('./salesAppInitializer');
  if (!(await salesAppInitializer.isSalesInitialized(organizationId))) {
    await salesAppInitializer.initializeSales(organizationId);
  }

  return { success: true, organizationId };
}

async function isAuditInitialized(organizationId) {
  const TenantAppConfiguration = require('../models/TenantAppConfiguration');
  const config = await TenantAppConfiguration.findOne({
    organizationId,
    appKey: 'AUDIT',
    enabled: true,
  }).lean();
  return Boolean(config);
}

module.exports = {
  initializeAudit,
  isAuditInitialized,
};
