'use strict';

/**
 * Backfill OCR text index for existing file documents (TXT, CSV, PDF).
 *
 * Usage:
 *   node server/scripts/backfillDocumentsOcrIndex.js --dry-run
 *   node server/scripts/backfillDocumentsOcrIndex.js
 *   node server/scripts/backfillDocumentsOcrIndex.js --organizationId=<id>
 *   node server/scripts/backfillDocumentsOcrIndex.js --limit=100
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Document = require('../models/Document');
const { indexDocumentOcrFromStorage, queueDocumentOcrIndex } = require('../services/documentOcrIndexService');
const { OCR_SUPPORTED_MIME_TYPES, OCR_SUPPORTED_FILE_TYPES } = require('../constants/documentOcrIndex');

const DEFAULT_LIMIT = Math.min(
  5000,
  Math.max(1, parseInt(process.env.DOCUMENT_OCR_BACKFILL_LIMIT || '500', 10))
);

function buildBackfillQuery(organizationId) {
  const query = {
    deletedAt: null,
    documentType: 'file',
    storagePath: { $nin: [null, ''] },
    $or: [
      { ocrStatus: null },
      { ocrStatus: { $exists: false } },
      { ocrStatus: 'pending' },
      { ocrStatus: 'failed' }
    ],
    $and: [
      {
        $or: [
          { mimeType: { $in: [...OCR_SUPPORTED_MIME_TYPES] } },
          { fileType: { $in: [...OCR_SUPPORTED_FILE_TYPES] } }
        ]
      }
    ]
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return query;
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  const dryRun = process.argv.includes('--dry-run');
  const orgArg = process.argv.find((arg) => arg.startsWith('--organizationId='));
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const organizationId = orgArg ? orgArg.split('=')[1] : null;
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : DEFAULT_LIMIT;

  if (!Number.isFinite(limit) || limit < 1) {
    console.error('Invalid --limit value');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const query = buildBackfillQuery(organizationId);
  const candidates = await Document.find(query)
    .select('_id organizationId title mimeType fileType ocrStatus')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  let queued = 0;
  let indexed = 0;
  let failed = 0;
  let skipped = 0;

  console.log(`[ocr-backfill] candidates=${candidates.length} dryRun=${dryRun} limit=${limit}`);

  for (const doc of candidates) {
    if (dryRun) {
      queued += 1;
      continue;
    }

    try {
      const result = await indexDocumentOcrFromStorage({
        organizationId: doc.organizationId,
        documentId: doc._id
      });

      if (result.status === 'indexed') {
        indexed += 1;
      } else if (result.status === 'skipped') {
        skipped += 1;
      } else {
        failed += 1;
        await queueDocumentOcrIndex({
          organizationId: doc.organizationId,
          documentId: doc._id,
          mimeType: doc.mimeType,
          fileType: doc.fileType
        });
        queued += 1;
      }
    } catch (error) {
      failed += 1;
      console.error(`[ocr-backfill] document ${doc._id} (${doc.title || 'untitled'}):`, error.message);
      try {
        await queueDocumentOcrIndex({
          organizationId: doc.organizationId,
          documentId: doc._id,
          mimeType: doc.mimeType,
          fileType: doc.fileType
        });
        queued += 1;
      } catch (queueError) {
        console.error(`[ocr-backfill] queue failed for ${doc._id}:`, queueError.message);
      }
    }
  }

  console.log(JSON.stringify({
    dryRun,
    scanned: candidates.length,
    indexed,
    failed,
    skipped,
    queuedForRetry: queued
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('[ocr-backfill] fatal:', error);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
