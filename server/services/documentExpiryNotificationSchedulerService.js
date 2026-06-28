'use strict';

/**
 * Cross-tenant scheduler: notify document owners when expiry is within 7 days.
 */

const Organization = require('../models/Organization');
const Document = require('../models/Document');
const Notification = require('../models/Notification');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../utils/tenantContext');

const DEBUG = process.env.DOCUMENT_EXPIRY_NOTIFICATION_DEBUG === 'true';
const BATCH_LIMIT = Math.min(500, Math.max(10, parseInt(process.env.DOCUMENT_EXPIRY_NOTIFICATION_BATCH_LIMIT || '200', 10)));
const DAYS_AHEAD = Math.min(30, Math.max(1, parseInt(process.env.DOCUMENT_EXPIRY_NOTIFICATION_DAYS || '7', 10)));

/**
 * @returns {Promise<{ tenantsProcessed: number, scanned: number, notified: number, errors: number }>}
 */
async function tickDocumentExpiryNotifications() {
  if (process.env.ENABLE_DOCUMENT_EXPIRY_NOTIFICATION_SCHEDULER === 'false') {
    return { tenantsProcessed: 0, scanned: 0, notified: 0, errors: 0 };
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
  let notified = 0;
  let errors = 0;

  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + DAYS_AHEAD);

  for (const tenant of tenants) {
    const dbName = tenant.database?.name;
    if (!dbName) continue;

    let conn;
    try {
      conn = await dbConnectionManager.getOrganizationConnection(dbName);
      if (conn.readyState !== 1) await conn.asPromise();
    } catch (err) {
      errors += 1;
      console.error(`[documentExpiry] tenant ${tenant._id} DB connect failed:`, err.message);
      continue;
    }

    try {
      await runWithTenantContext(
        { organizationId: tenant._id, connection: conn, databaseName: dbName },
        async () => {
          const candidates = await Document.find({
            organizationId: tenant._id,
            deletedAt: null,
            assignedTo: { $ne: null },
            expiryDate: { $gte: now, $lte: horizon },
            expiryNotifiedAt: null
          })
            .select('_id title documentNumber expiryDate assignedTo')
            .limit(BATCH_LIMIT)
            .lean();

          for (const doc of candidates) {
            scanned += 1;
            if (!doc.assignedTo) continue;
            try {
              const expiryLabel = doc.expiryDate
                ? new Date(doc.expiryDate).toLocaleDateString('en-US', { dateStyle: 'medium' })
                : 'soon';
              await Notification.create({
                userId: doc.assignedTo,
                organizationId: tenant._id,
                appKey: 'PLATFORM',
                sourceAppKey: 'PLATFORM',
                eventType: 'document_expiry_soon',
                title: 'Document expiring soon',
                message: `"${doc.title || doc.documentNumber}" expires on ${expiryLabel}.`,
                metadata: {
                  documentId: String(doc._id),
                  documentNumber: doc.documentNumber,
                  expiryDate: doc.expiryDate
                },
                channels: { inApp: true, email: false, push: false }
              });
              await Document.updateOne(
                { _id: doc._id },
                { $set: { expiryNotifiedAt: new Date() } }
              );
              notified += 1;
            } catch (err) {
              errors += 1;
              console.error(`[documentExpiry] document ${doc._id}:`, err.message);
            }
          }
        }
      );
      tenantsProcessed += 1;
    } catch (err) {
      errors += 1;
      console.error(`[documentExpiry] tenant ${tenant._id} tick failed:`, err.message);
    }
  }

  if (DEBUG || notified > 0) {
    console.log(
      `[documentExpiry] tick: tenants=${tenantsProcessed} scanned=${scanned} notified=${notified} errors=${errors}`
    );
  }

  return { tenantsProcessed, scanned, notified, errors };
}

module.exports = {
  tickDocumentExpiryNotifications
};
