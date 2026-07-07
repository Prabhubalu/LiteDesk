'use strict';

/**
 * One-time migration: legacy knowledge_article Document rows → ContentDocument.
 *
 * Usage:
 *   node server/scripts/migrateKnowledgeArticlesToContentStudio.js --org-slug acme
 *   node server/scripts/migrateKnowledgeArticlesToContentStudio.js --dry-run
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const Document = require('../models/Document');
const ContentDocument = require('../models/ContentDocument');
const ContentDocumentVersion = require('../models/ContentDocumentVersion');
const { createEmptyBlockDocument } = require('../services/contentStudio/contentBlockValidationService');
const { htmlToBlocks } = require('../services/contentStudio/htmlToBlocksService');

function parseArgs(argv) {
  const out = { dryRun: false, orgSlug: null, orgId: null };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--org-slug') out.orgSlug = argv[++i];
    else if (arg === '--org-id') out.orgId = argv[++i];
  }
  return out;
}

async function migrateOrganization(organizationId, { dryRun }) {
  const legacyRows = await Document.find({
    organizationId,
    deletedAt: null,
    documentType: 'knowledge_article',
  }).lean();

  let created = 0;
  let skipped = 0;

  for (const row of legacyRows) {
    const existing = await ContentDocument.findOne({
      organizationId,
      addonKey: 'articles',
      slug: String(row.slug || row.title || row._id).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      deletedAt: null,
    }).select('_id').lean();

    if (existing) {
      skipped += 1;
      continue;
    }

    const html = row.richContent?.html || row.richContentText || '';
    const blocks = htmlToBlocks(html);
    const payload = {
      organizationId,
      addonKey: 'articles',
      appKey: 'HELPDESK',
      contentType: 'knowledge_article',
      title: row.title || 'Untitled',
      slug: String(row.slug || row.title || row._id).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 120),
      summary: row.description || '',
      visibility: row.visibility?.portalVisible ? 'portal' : 'internal',
      status: row.status === 'published' ? 'published' : 'draft',
      searchText: String(row.richContentText || row.description || row.title || ''),
      authorId: row.createdBy || null,
      createdBy: row.createdBy || null,
      updatedBy: row.updatedBy || null,
      publishedAt: row.status === 'published' ? row.updatedAt : null,
    };

    if (dryRun) {
      created += 1;
      continue;
    }

    const doc = await ContentDocument.create(payload);
    const version = await ContentDocumentVersion.create({
      organizationId,
      contentDocumentId: doc._id,
      version: 1,
      document: { blocks },
      blocks,
      publishStatus: row.status === 'published' ? 'published' : 'draft',
      createdBy: row.createdBy || null,
    });
    doc.currentVersionId = version._id;
    if (row.status === 'published') doc.publishedVersionId = version._id;
    await doc.save();
    created += 1;
  }

  return { created, skipped, total: legacyRows.length };
}

async function main() {
  const args = parseArgs(process.argv);
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  let orgIds = [];
  if (args.orgId) orgIds = [args.orgId];
  else if (args.orgSlug) {
    const org = await Organization.findOne({ slug: args.orgSlug }).select('_id').lean();
    if (!org) throw new Error(`Organization not found: ${args.orgSlug}`);
    orgIds = [org._id];
  } else {
    const orgs = await Organization.find({ isTenant: true }).select('_id slug').lean();
    orgIds = orgs.map((org) => org._id);
  }

  let totalCreated = 0;
  let totalSkipped = 0;
  for (const organizationId of orgIds) {
    const result = await migrateOrganization(organizationId, args);
    totalCreated += result.created;
    totalSkipped += result.skipped;
    console.log(`[migrateKnowledgeArticles] org=${organizationId} created=${result.created} skipped=${result.skipped} total=${result.total}`);
  }

  console.log(`[migrateKnowledgeArticles] done dryRun=${args.dryRun} created=${totalCreated} skipped=${totalSkipped}`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('[migrateKnowledgeArticles] failed', error);
  process.exit(1);
});
