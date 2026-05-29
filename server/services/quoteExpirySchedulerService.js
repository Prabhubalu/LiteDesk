'use strict';

/**
 * Cross-tenant scheduler: expire quotes past validUntil.
 */

const Organization = require('../models/Organization');
const Quote = require('../models/Quote');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../utils/tenantContext');
const {
  QUOTE_AUTO_EXPIRE_STATUSES,
  isQuoteValidityExpired,
  expireQuoteIfDue
} = require('./quoteExpiryService');

const DEBUG = process.env.QUOTE_EXPIRY_SCHEDULER_DEBUG === 'true';
const BATCH_LIMIT = Math.min(500, Math.max(10, parseInt(process.env.QUOTE_EXPIRY_BATCH_LIMIT || '200', 10)));

/**
 * @returns {Promise<{ tenantsProcessed: number, scanned: number, expired: number, errors: number }>}
 */
async function tickQuoteExpiry() {
  if (process.env.ENABLE_QUOTE_EXPIRY_SCHEDULER === 'false') {
    return { tenantsProcessed: 0, scanned: 0, expired: 0, errors: 0 };
  }

  const tenants = await Organization.find({
    isTenant: true,
    isActive: true,
    'database.name': { $exists: true, $nin: [null, ''] }
  })
    .select('_id database.name')
    .lean();

  let tenantsProcessed = 0;
  let scanned = 0;
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
      console.error(`[quoteExpiry] tenant ${tenant._id} DB connect failed:`, err.message);
      continue;
    }

    try {
      await runWithTenantContext(
        { organizationId: tenant._id, connection: conn, databaseName: dbName },
        async () => {
          const candidates = await Quote.find({
            organizationId: tenant._id,
            deletedAt: null,
            activeRevision: { $ne: false },
            status: { $in: QUOTE_AUTO_EXPIRE_STATUSES },
            validUntil: { $ne: null }
          })
            .limit(BATCH_LIMIT)
            .exec();

          for (const quote of candidates) {
            scanned += 1;
            if (!isQuoteValidityExpired(quote)) continue;
            try {
              const result = await expireQuoteIfDue(quote, { trigger: 'scheduler' });
              if (result.expired) expired += 1;
            } catch (err) {
              errors += 1;
              console.error(`[quoteExpiry] quote ${quote._id}:`, err.message);
            }
          }
        }
      );
      tenantsProcessed += 1;
    } catch (err) {
      errors += 1;
      console.error(`[quoteExpiry] tenant ${tenant._id} tick failed:`, err.message);
    }
  }

  if (DEBUG || expired > 0) {
    console.log(
      `[quoteExpiry] tick: tenants=${tenantsProcessed} scanned=${scanned} expired=${expired} errors=${errors}`
    );
  }

  return { tenantsProcessed, scanned, expired, errors };
}

module.exports = {
  tickQuoteExpiry
};
