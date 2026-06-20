'use strict';

/**
 * Backfill semantic search embeddings for existing documents.
 *
 * Usage:
 *   node server/scripts/backfillDocumentsSemanticIndex.js --dry-run
 *   node server/scripts/backfillDocumentsSemanticIndex.js
 *   node server/scripts/backfillDocumentsSemanticIndex.js --organizationId=<id>
 *   node server/scripts/backfillDocumentsSemanticIndex.js --limit=100
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Document = require('../models/Document');
const { indexDocumentSemanticEmbedding } = require('../services/documentSemanticIndexService');

const DEFAULT_LIMIT = Math.min(
  5000,
  Math.max(1, parseInt(process.env.DOCUMENT_SEMANTIC_BACKFILL_LIMIT || '500', 10))
);

function buildBackfillQuery(organizationId) {
  const query = {
    deletedAt: null,
    $or: [
      { searchEmbedding: null },
      { searchEmbedding: { $exists: false } },
      { semanticIndexedAt: null },
      { semanticIndexedAt: { $exists: false } }
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
    .select('_id organizationId title documentNumber updatedAt')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  let indexed = 0;
  let failed = 0;

  console.log(`[semantic-backfill] candidates=${candidates.length} dryRun=${dryRun} limit=${limit}`);

  for (const doc of candidates) {
    if (dryRun) {
      indexed += 1;
      continue;
    }

    try {
      await indexDocumentSemanticEmbedding({
        organizationId: doc.organizationId,
        documentId: doc._id,
        doc
      });
      indexed += 1;
    } catch (error) {
      failed += 1;
      console.error(`[semantic-backfill] document ${doc._id} (${doc.title || 'untitled'}):`, error.message);
    }
  }

  console.log(JSON.stringify({
    dryRun,
    scanned: candidates.length,
    indexed,
    failed
  }, null, 2));

  await mongoose.disconnect();
}

module.exports = {
  buildBackfillQuery,
  DEFAULT_LIMIT
};

if (require.main === module) {
  main().catch(async (error) => {
    console.error('[semantic-backfill] fatal:', error);
    try {
      await mongoose.disconnect();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
}
