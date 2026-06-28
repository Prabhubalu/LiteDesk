'use strict';

/**
 * Phase 6: migrate legacy PersonFileAttachment rows into Documents + people_documents links.
 *
 * Usage:
 *   node server/scripts/migratePersonAttachmentsToDocuments.js
 *   node server/scripts/migratePersonAttachmentsToDocuments.js --dry-run
 *   node server/scripts/migratePersonAttachmentsToDocuments.js --organizationId=<id>
 */

require('dotenv').config();
const mongoose = require('mongoose');

function inferFileType(fileName) {
  const ext = String(fileName || '').split('.').pop()?.toUpperCase() || '';
  if (['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'SVG'].includes(ext)) return 'IMAGE';
  if (['DOC', 'DOCX', 'PDF', 'XLS', 'XLSX', 'PPT', 'PPTX', 'TXT', 'CSV', 'ZIP'].includes(ext)) {
    return ext;
  }
  return ext || 'FILE';
}

async function generateDocumentNumber(Document, organizationId) {
  const latest = await Document.findOne({ organizationId })
    .sort({ documentNumber: -1 })
    .select('documentNumber')
    .lean();
  const current = latest?.documentNumber ? parseInt(String(latest.documentNumber).replace(/\D/g, ''), 10) : 0;
  const next = Number.isFinite(current) ? current + 1 : 1;
  return `DOC-${String(next).padStart(6, '0')}`;
}

async function migrateAttachments({
  PersonFileAttachment,
  Document,
  DocumentVersion,
  RelationshipInstance,
  organizationId = null,
  dryRun = false
}) {
  const query = { migratedDocumentId: null };
  if (organizationId) query.organizationId = organizationId;

  const attachments = await PersonFileAttachment.find(query).sort({ created_at: 1 }).lean();
  let migrated = 0;
  let skipped = 0;

  for (const attachment of attachments) {
    const existingDoc = await Document.findOne({
      organizationId: attachment.organizationId,
      legacyAttachmentId: attachment._id
    }).select('_id').lean();

    if (existingDoc) {
      if (!dryRun) {
        await PersonFileAttachment.updateOne(
          { _id: attachment._id },
          { $set: { migratedDocumentId: existingDoc._id } }
        );
      }
      skipped += 1;
      continue;
    }

    if (dryRun) {
      migrated += 1;
      continue;
    }

    const documentNumber = await generateDocumentNumber(Document, attachment.organizationId);
    const fileType = inferFileType(attachment.fileName);
    const doc = await Document.create({
      organizationId: attachment.organizationId,
      documentNumber,
      title: attachment.fileName,
      documentType: 'file',
      sourceType: 'internal',
      fileType,
      fileSizeBytes: attachment.fileSize,
      storageProvider: 'oci',
      storagePath: attachment.storagePath,
      versionNumber: 1,
      assignedTo: attachment.uploaded_by,
      createdBy: attachment.uploaded_by,
      modifiedBy: attachment.uploaded_by,
      status: 'published',
      legacyAttachmentId: attachment._id,
      createdAt: attachment.created_at || new Date(),
      updatedAt: attachment.created_at || new Date()
    });

    const version = await DocumentVersion.create({
      organizationId: attachment.organizationId,
      documentId: doc._id,
      versionNumber: 1,
      storagePath: attachment.storagePath,
      fileSizeBytes: attachment.fileSize,
      fileType,
      createdBy: attachment.uploaded_by,
      changeSummary: 'Migrated from person attachment',
      createdAt: attachment.created_at || new Date()
    });

    await Document.updateOne({ _id: doc._id }, { currentVersionId: version._id });

    const existingLink = await RelationshipInstance.findOne({
      organizationId: attachment.organizationId,
      relationshipKey: 'people_documents',
      'source.appKey': 'sales',
      'source.moduleKey': 'people',
      'source.recordId': attachment.personId,
      'target.appKey': 'platform',
      'target.moduleKey': 'documents',
      'target.recordId': doc._id
    }).select('_id').lean();

    if (!existingLink) {
      await RelationshipInstance.create({
        organizationId: attachment.organizationId,
        relationshipKey: 'people_documents',
        source: {
          appKey: 'sales',
          moduleKey: 'people',
          recordId: attachment.personId
        },
        target: {
          appKey: 'platform',
          moduleKey: 'documents',
          recordId: doc._id
        },
        createdBy: attachment.uploaded_by
      });
    }

    await PersonFileAttachment.updateOne(
      { _id: attachment._id },
      { $set: { migratedDocumentId: doc._id } }
    );
    migrated += 1;
  }

  return { migrated, skipped, total: attachments.length };
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  const dryRun = process.argv.includes('--dry-run');
  const orgArg = process.argv.find((arg) => arg.startsWith('--organizationId='));
  const organizationId = orgArg ? orgArg.split('=')[1] : null;

  await mongoose.connect(uri);

  const PersonFileAttachment = require('../models/PersonFileAttachment');
  const Document = require('../models/Document');
  const DocumentVersion = require('../models/DocumentVersion');
  const RelationshipInstance = require('../models/RelationshipInstance');

  const result = await migrateAttachments({
    PersonFileAttachment,
    Document,
    DocumentVersion,
    RelationshipInstance,
    organizationId,
    dryRun
  });

  const mode = dryRun ? ' (dry run)' : '';
  console.log(
    `Person attachment migration${mode}: ${result.migrated} migrated, ${result.skipped} skipped, ${result.total} scanned.`
  );

  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { migrateAttachments, inferFileType };
