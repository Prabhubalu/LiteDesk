'use strict';

const Organization = require('../models/Organization');
const Document = require('../models/Document');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../utils/tenantContext');
const { indexDocumentOcrFromStorage } = require('./documentOcrIndexService');

const DEBUG = process.env.DOCUMENT_OCR_INDEX_SCHEDULER_DEBUG === 'true';
const BATCH_LIMIT = Math.min(200, Math.max(10, parseInt(process.env.DOCUMENT_OCR_INDEX_BATCH_LIMIT || '50', 10)));

async function tickDocumentOcrIndex() {
  if (process.env.ENABLE_DOCUMENT_OCR_INDEX_SCHEDULER === 'false') {
    return { tenantsProcessed: 0, scanned: 0, indexed: 0, failed: 0, errors: 0 };
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
  let indexed = 0;
  let failed = 0;
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
      console.error(`[documentOcrIndex] tenant ${tenant._id} DB connect failed:`, err.message);
      continue;
    }

    try {
      await runWithTenantContext(
        { organizationId: tenant._id, connection: conn, databaseName: dbName },
        async () => {
          const candidates = await Document.find({
            organizationId: tenant._id,
            deletedAt: null,
            documentType: 'file',
            ocrStatus: 'pending',
            storagePath: { $nin: [null, ''] }
          })
            .select('_id')
            .limit(BATCH_LIMIT)
            .lean();

          for (const doc of candidates) {
            scanned += 1;
            try {
              const result = await indexDocumentOcrFromStorage({
                organizationId: tenant._id,
                documentId: doc._id
              });
              if (result.status === 'indexed') indexed += 1;
              if (result.status === 'failed') failed += 1;
            } catch (err) {
              failed += 1;
              errors += 1;
              console.error(`[documentOcrIndex] document ${doc._id}:`, err.message);
            }
          }
        }
      );
      tenantsProcessed += 1;
    } catch (err) {
      errors += 1;
      console.error(`[documentOcrIndex] tenant ${tenant._id} tick failed:`, err.message);
    }
  }

  if (DEBUG || indexed > 0 || failed > 0) {
    console.log(
      `[documentOcrIndex] tick: tenants=${tenantsProcessed} scanned=${scanned} indexed=${indexed} failed=${failed} errors=${errors}`
    );
  }

  return { tenantsProcessed, scanned, indexed, failed, errors };
}

module.exports = {
  tickDocumentOcrIndex
};
