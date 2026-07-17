'use strict';

/**
 * Backfill semantic search embeddings for existing documents.
 *
 * Hash path (Document.searchEmbedding):
 *   node server/scripts/backfillDocumentsSemanticIndex.js --dry-run
 *   node server/scripts/backfillDocumentsSemanticIndex.js
 *   node server/scripts/backfillDocumentsSemanticIndex.js --organizationId=<id>
 *   node server/scripts/backfillDocumentsSemanticIndex.js --limit=100
 *
 * Real AI vector chunks (AiVectorChunk via embed queue / inline):
 *   node server/scripts/backfillDocumentsSemanticIndex.js --ai-embed --dry-run
 *   node server/scripts/backfillDocumentsSemanticIndex.js --ai-embed --organizationId=<id> --limit=50
 *   node server/scripts/backfillDocumentsSemanticIndex.js --ai-embed-only --organizationId=<id>
 *
 * Requires OPENAI_API_KEY (or org BYOK) when running --ai-embed without --dry-run.
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

/** Broader set for AI embed backfill — any non-deleted document. */
function buildAiEmbedBackfillQuery(organizationId) {
  const query = { deletedAt: null };
  if (organizationId) {
    query.organizationId = organizationId;
  }
  return query;
}

function parseArgs(argv = process.argv) {
  const dryRun = argv.includes('--dry-run');
  const aiEmbedOnly = argv.includes('--ai-embed-only');
  const aiEmbed = argv.includes('--ai-embed') || aiEmbedOnly;
  const orgArg = argv.find((arg) => arg.startsWith('--organizationId='));
  const limitArg = argv.find((arg) => arg.startsWith('--limit='));
  const organizationId = orgArg ? orgArg.split('=')[1] : null;
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : DEFAULT_LIMIT;
  return { dryRun, aiEmbed, aiEmbedOnly, organizationId, limit };
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  const { dryRun, aiEmbed, aiEmbedOnly, organizationId, limit } = parseArgs();

  if (!Number.isFinite(limit) || limit < 1) {
    console.error('Invalid --limit value');
    process.exit(1);
  }

  await mongoose.connect(uri);

  let hashIndexed = 0;
  let hashFailed = 0;
  let hashScanned = 0;

  if (!aiEmbedOnly) {
    const query = buildBackfillQuery(organizationId);
    const candidates = await Document.find(query)
      .select('_id organizationId title documentNumber updatedAt')
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    hashScanned = candidates.length;
    console.log(`[semantic-backfill] hash candidates=${candidates.length} dryRun=${dryRun} limit=${limit}`);

    for (const doc of candidates) {
      if (dryRun) {
        hashIndexed += 1;
        continue;
      }

      try {
        await indexDocumentSemanticEmbedding({
          organizationId: doc.organizationId,
          documentId: doc._id,
          doc
        });
        hashIndexed += 1;
      } catch (error) {
        hashFailed += 1;
        console.error(`[semantic-backfill] document ${doc._id} (${doc.title || 'untitled'}):`, error.message);
      }
    }
  }

  let aiEnqueued = 0;
  let aiFailed = 0;
  let aiScanned = 0;

  if (aiEmbed) {
    const aiQuery = buildAiEmbedBackfillQuery(organizationId);
    const aiCandidates = await Document.find(aiQuery)
      .select('_id organizationId title updatedAt')
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    aiScanned = aiCandidates.length;
    console.log(`[semantic-backfill] ai-embed candidates=${aiCandidates.length} dryRun=${dryRun} limit=${limit}`);

    let enqueueDocumentEmbed = null;
    if (!dryRun) {
      ({ enqueueDocumentEmbed } = require('../services/ai/aiEmbedQueueService'));
    }

    for (const doc of aiCandidates) {
      if (dryRun) {
        aiEnqueued += 1;
        continue;
      }

      try {
        enqueueDocumentEmbed({
          organizationId: doc.organizationId,
          documentId: doc._id,
        });
        aiEnqueued += 1;
      } catch (error) {
        aiFailed += 1;
        console.error(`[semantic-backfill] ai-embed ${doc._id} (${doc.title || 'untitled'}):`, error.message);
      }
    }
  }

  console.log(JSON.stringify({
    dryRun,
    aiEmbed,
    aiEmbedOnly,
    hash: { scanned: hashScanned, indexed: hashIndexed, failed: hashFailed },
    aiEmbedResult: { scanned: aiScanned, enqueued: aiEnqueued, failed: aiFailed },
  }, null, 2));

  await mongoose.disconnect();
}

module.exports = {
  buildBackfillQuery,
  buildAiEmbedBackfillQuery,
  parseArgs,
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
