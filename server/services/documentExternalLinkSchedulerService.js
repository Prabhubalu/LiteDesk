'use strict';

/**
 * Cross-tenant scheduler: verify external document links and mark unavailable ones.
 */

const Organization = require('../models/Organization');
const Document = require('../models/Document');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../utils/tenantContext');
const { probeExternalUrl } = require('./documentExternalLinkService');

const DEBUG = process.env.DOCUMENT_EXTERNAL_LINK_SCHEDULER_DEBUG === 'true';
const BATCH_LIMIT = Math.min(500, Math.max(10, parseInt(process.env.DOCUMENT_EXTERNAL_LINK_BATCH_LIMIT || '100', 10)));

/**
 * @returns {Promise<{ tenantsProcessed: number, scanned: number, unavailable: number, errors: number }>}
 */
async function tickDocumentExternalLinkChecks() {
  if (process.env.ENABLE_DOCUMENT_EXTERNAL_LINK_SCHEDULER === 'false') {
    return { tenantsProcessed: 0, scanned: 0, unavailable: 0, errors: 0 };
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
  let unavailable = 0;
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
      console.error(`[documentExternalLink] tenant ${tenant._id} DB connect failed:`, err.message);
      continue;
    }

    try {
      await runWithTenantContext(
        { organizationId: tenant._id, connection: conn, databaseName: dbName },
        async () => {
          const candidates = await Document.find({
            organizationId: tenant._id,
            deletedAt: null,
            documentType: 'external_link',
            externalUrl: { $nin: [null, ''] }
          })
            .select('_id externalUrl externalLinkStatus')
            .limit(BATCH_LIMIT)
            .lean();

          for (const doc of candidates) {
            scanned += 1;
            try {
              const probe = await probeExternalUrl(doc.externalUrl);
              const nextStatus = probe.available ? 'available' : 'unavailable';
              if (doc.externalLinkStatus !== nextStatus) {
                await Document.updateOne(
                  { _id: doc._id },
                  { $set: { externalLinkStatus: nextStatus } }
                );
              }
              if (!probe.available) unavailable += 1;
            } catch (err) {
              errors += 1;
              console.error(`[documentExternalLink] document ${doc._id}:`, err.message);
            }
          }
        }
      );
      tenantsProcessed += 1;
    } catch (err) {
      errors += 1;
      console.error(`[documentExternalLink] tenant ${tenant._id} tick failed:`, err.message);
    }
  }

  if (DEBUG || unavailable > 0) {
    console.log(
      `[documentExternalLink] tick: tenants=${tenantsProcessed} scanned=${scanned} unavailable=${unavailable} errors=${errors}`
    );
  }

  return { tenantsProcessed, scanned, unavailable, errors };
}

module.exports = {
  tickDocumentExternalLinkChecks
};
