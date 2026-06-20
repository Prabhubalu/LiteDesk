'use strict';

/**
 * Cross-tenant scheduler: expire document reservations past reservationExpiresAt.
 */

const Organization = require('../models/Organization');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../utils/tenantContext');
const { expireReservationsForOrganization } = require('./documentEditingCoordinationService');

const DEBUG = process.env.DOCUMENT_RESERVATION_SCHEDULER_DEBUG === 'true';

async function tickDocumentReservationExpiration() {
  if (process.env.ENABLE_DOCUMENT_RESERVATION_SCHEDULER === 'false') {
    return { tenantsProcessed: 0, expired: 0, errors: 0 };
  }

  const tenants = await Organization.find({
    isTenant: true,
    isActive: true,
    'database.name': { $exists: true, $nin: [null, ''] }
  })
    .select('_id database.name')
    .lean();

  let tenantsProcessed = 0;
  let expired = 0;
  let errors = 0;

  for (const tenant of tenants) {
    const dbName = tenant.database?.name;
    if (!dbName) continue;

    let conn;
    try {
      conn = await dbConnectionManager.getOrganizationConnection(dbName);
      if (conn.readyState !== 1) await conn.asPromise();
    } catch (err) {
      errors += 1;
      console.error(`[documentReservation] tenant ${tenant._id} DB connect failed:`, err.message);
      continue;
    }

    try {
      await runWithTenantContext(
        { organizationId: tenant._id, connection: conn, databaseName: dbName },
        async () => {
          const count = await expireReservationsForOrganization(tenant._id);
          expired += count;
        }
      );
      tenantsProcessed += 1;
    } catch (err) {
      errors += 1;
      console.error(`[documentReservation] tenant ${tenant._id} tick failed:`, err.message);
    }
  }

  if (DEBUG || expired > 0) {
    console.log(`[documentReservation] tick: tenants=${tenantsProcessed} expired=${expired} errors=${errors}`);
  }

  return { tenantsProcessed, expired, errors };
}

module.exports = {
  tickDocumentReservationExpiration
};
