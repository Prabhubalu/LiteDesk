'use strict';

/**
 * Phase 6 follow-up: migrate historical comment attachments into Documents.
 *
 * Sources:
 * - DealComment.attachments
 * - TaskComment.attachments
 * - RecordActivity (type=comment).attachments
 *
 * Usage:
 *   node server/scripts/migrateCommentAttachmentsToDocuments.js --dry-run
 *   node server/scripts/migrateCommentAttachmentsToDocuments.js
 *   node server/scripts/migrateCommentAttachmentsToDocuments.js --organizationId=<id>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { parseStoragePath } = require('../services/fileStorageService');
const {
  SOURCE_APP_BY_MODULE,
  DOCUMENT_ATTACHMENT_MODULES
} = require('../constants/defaultDocumentRelationships');

function buildLegacyKey(sourceType, commentId, index) {
  return `comment:${sourceType}:${commentId}:${index}`;
}

function resolveStoragePathFromAttachment(attachment) {
  if (attachment?.storagePath) {
    return String(attachment.storagePath);
  }
  const parsed = parseStoragePath(attachment?.url);
  if (!parsed) return null;
  if (parsed.driver === 'oci') {
    return `oci:${parsed.key}`;
  }
  return attachment?.url || null;
}

async function migrateCommentCollection({
  Model,
  sourceType,
  moduleKey,
  recordIdField,
  documentService,
  organizationId,
  dryRun
}) {
  const query = { attachments: { $exists: true, $not: { $size: 0 } } };
  if (organizationId) query.organizationId = organizationId;

  const comments = await Model.find(query)
    .select(`_id organizationId author ${recordIdField} moduleKey recordId attachments`)
    .lean();

  let migrated = 0;
  let skipped = 0;
  let updatedComments = 0;

  for (const comment of comments) {
    const attachments = Array.isArray(comment.attachments) ? comment.attachments : [];
    let changed = false;
    const nextAttachments = [];

    for (let index = 0; index < attachments.length; index += 1) {
      const attachment = attachments[index];
      if (!attachment?.url || !attachment?.filename) {
        nextAttachments.push(attachment);
        continue;
      }
      if (attachment.documentId) {
        nextAttachments.push(attachment);
        skipped += 1;
        continue;
      }

      const storagePath = resolveStoragePathFromAttachment(attachment);
      if (!storagePath) {
        nextAttachments.push(attachment);
        skipped += 1;
        continue;
      }

      const legacyKey = buildLegacyKey(sourceType, comment._id, index);
      const normalizedModuleKey = sourceType === 'record_activity'
        ? String(comment.moduleKey || '').toLowerCase()
        : moduleKey;
      const recordId = sourceType === 'record_activity'
        ? comment.recordId
        : comment[recordIdField];

      if (!DOCUMENT_ATTACHMENT_MODULES.includes(normalizedModuleKey)) {
        nextAttachments.push(attachment);
        skipped += 1;
        continue;
      }

      if (dryRun) {
        migrated += 1;
        nextAttachments.push({ ...attachment, documentId: 'dry-run' });
        changed = true;
        continue;
      }

      const registration = await documentService.registerStoredFileAsDocument({
        organizationId: comment.organizationId,
        userId: comment.author,
        moduleKey: normalizedModuleKey,
        recordId,
        appKey: SOURCE_APP_BY_MODULE[normalizedModuleKey] || 'platform',
        storagePath,
        fileName: attachment.filename,
        mimeType: attachment.mimetype || attachment.mimeType || null,
        fileSizeBytes: attachment.size || null,
        legacyCommentAttachmentKey: legacyKey,
        changeSummary: 'Migrated from comment attachment'
      });

      const documentId = registration?.document?._id;
      if (!documentId) {
        nextAttachments.push(attachment);
        skipped += 1;
        continue;
      }

      nextAttachments.push({
        ...attachment,
        documentId
      });
      migrated += 1;
      changed = true;
    }

    if (changed && !dryRun) {
      await Model.updateOne({ _id: comment._id }, { $set: { attachments: nextAttachments } });
      updatedComments += 1;
    } else if (changed && dryRun) {
      updatedComments += 1;
    }
  }

  return { migrated, skipped, updatedComments, scanned: comments.length };
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

  const DealComment = require('../models/DealComment');
  const TaskComment = require('../models/TaskComment');
  const RecordActivity = require('../models/RecordActivity');
  const documentService = require('../services/documentService');

  const dealResult = await migrateCommentCollection({
    Model: DealComment,
    sourceType: 'deal',
    moduleKey: 'deals',
    recordIdField: 'dealId',
    documentService,
    organizationId,
    dryRun
  });

  const taskResult = await migrateCommentCollection({
    Model: TaskComment,
    sourceType: 'task',
    moduleKey: 'tasks',
    recordIdField: 'taskId',
    documentService,
    organizationId,
    dryRun
  });

  const activityQuery = {
    type: 'comment',
    attachments: { $exists: true, $not: { $size: 0 } }
  };
  if (organizationId) activityQuery.organizationId = organizationId;

  const activityComments = await RecordActivity.find(activityQuery)
    .select('_id organizationId author moduleKey recordId attachments')
    .lean();

  let activityMigrated = 0;
  let activitySkipped = 0;
  let activityUpdated = 0;

  for (const comment of activityComments) {
    const attachments = Array.isArray(comment.attachments) ? comment.attachments : [];
    let changed = false;
    const nextAttachments = [];

    for (let index = 0; index < attachments.length; index += 1) {
      const attachment = attachments[index];
      if (!attachment?.url || !attachment?.filename) {
        nextAttachments.push(attachment);
        continue;
      }
      if (attachment.documentId) {
        nextAttachments.push(attachment);
        activitySkipped += 1;
        continue;
      }

      const storagePath = resolveStoragePathFromAttachment(attachment);
      const normalizedModuleKey = String(comment.moduleKey || '').toLowerCase();
      if (!storagePath || !DOCUMENT_ATTACHMENT_MODULES.includes(normalizedModuleKey)) {
        nextAttachments.push(attachment);
        activitySkipped += 1;
        continue;
      }

      const legacyKey = buildLegacyKey('record_activity', comment._id, index);

      if (dryRun) {
        activityMigrated += 1;
        nextAttachments.push({ ...attachment, documentId: 'dry-run' });
        changed = true;
        continue;
      }

      const registration = await documentService.registerStoredFileAsDocument({
        organizationId: comment.organizationId,
        userId: comment.author,
        moduleKey: normalizedModuleKey,
        recordId: comment.recordId,
        appKey: SOURCE_APP_BY_MODULE[normalizedModuleKey] || 'platform',
        storagePath,
        fileName: attachment.filename,
        mimeType: attachment.mimetype || null,
        fileSizeBytes: attachment.size || null,
        legacyCommentAttachmentKey: legacyKey,
        changeSummary: 'Migrated from comment attachment'
      });

      const documentId = registration?.document?._id;
      if (!documentId) {
        nextAttachments.push(attachment);
        activitySkipped += 1;
        continue;
      }

      nextAttachments.push({ ...attachment, documentId });
      activityMigrated += 1;
      changed = true;
    }

    if (changed && !dryRun) {
      await RecordActivity.updateOne({ _id: comment._id }, { $set: { attachments: nextAttachments } });
      activityUpdated += 1;
    } else if (changed && dryRun) {
      activityUpdated += 1;
    }
  }

  const mode = dryRun ? ' (dry run)' : '';
  console.log(`Comment attachment migration${mode}:`);
  console.log(`  deals: ${dealResult.migrated} migrated, ${dealResult.skipped} skipped, ${dealResult.updatedComments}/${dealResult.scanned} comments updated`);
  console.log(`  tasks: ${taskResult.migrated} migrated, ${taskResult.skipped} skipped, ${taskResult.updatedComments}/${taskResult.scanned} comments updated`);
  console.log(`  record activity: ${activityMigrated} migrated, ${activitySkipped} skipped, ${activityUpdated}/${activityComments.length} comments updated`);

  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  buildLegacyKey,
  resolveStoragePathFromAttachment,
  migrateCommentCollection
};
