const { v4: uuidv4 } = require('uuid');
const path = require('path');
const MailroomAttachment = require('../../../models/MailroomAttachment');
const objectStorage = require('../../../services/objectStorageService');

function safeFileName(name) {
  const raw = String(name || 'file').trim() || 'file';
  const base = raw.replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.slice(0, 120);
}

function getMailroomPrefix() {
  return String(process.env.MAILROOM_ATTACHMENTS_PREFIX || 'mailroom').trim() || 'mailroom';
}

function buildDraftObjectKey({ organizationId, uploadId, attachmentId, fileName }) {
  const prefix = getMailroomPrefix();
  const safe = safeFileName(fileName);
  return `${prefix}/${String(organizationId)}/draft/${uploadId}/${attachmentId}-${safe}`;
}

function buildFinalObjectKey({ organizationId, conversationId, messageId, attachmentId, fileName }) {
  const prefix = getMailroomPrefix();
  const safe = safeFileName(fileName);
  return `${prefix}/${String(organizationId)}/${String(conversationId)}/${String(messageId)}/${attachmentId}-${safe}`;
}

async function createUploadedAttachment({
  organizationId,
  file,
  source = 'public_api',
  uploadedByUserId = null
}) {
  if (!file?.buffer || !file.size) {
    const err = new Error('File is required');
    err.statusCode = 400;
    throw err;
  }

  const attachmentId = uuidv4();
  const uploadId = uuidv4();
  const objectKey = buildDraftObjectKey({
    organizationId,
    uploadId,
    attachmentId,
    fileName: file.originalname
  });

  const hash = objectStorage.sha256(file.buffer);
  const { bucket } = await objectStorage.putBuffer({
    key: objectKey,
    buffer: file.buffer,
    contentType: file.mimetype || 'application/octet-stream',
    metadata: {
      sha256: hash,
      originalname: safeFileName(file.originalname),
      source: String(source || 'mailroom')
    }
  });

  const row = await MailroomAttachment.create({
    organizationId,
    status: 'uploaded',
    storageDriver: 'oci',
    bucket,
    objectKey,
    originalFileName: file.originalname || '',
    mimeType: file.mimetype || 'application/octet-stream',
    sizeBytes: Number(file.size) || 0,
    sha256: hash,
    uploadedByUserId,
    source
  });

  return row;
}

async function resolveAndLinkAttachments({
  organizationId,
  normalizedMessage,
  conversationId,
  messageId
}) {
  const attachments = Array.isArray(normalizedMessage?.attachments) ? normalizedMessage.attachments : [];
  const attachmentIds = attachments
    .map((a) => (a && typeof a === 'object' ? a.attachmentId : null))
    .filter(Boolean)
    .map(String);

  if (!attachmentIds.length) return [];

  const rows = await MailroomAttachment.find({
    organizationId,
    _id: { $in: attachmentIds },
    status: { $in: ['uploaded', 'linked'] }
  });

  // Move draft objects into final key (best-effort).
  for (const row of rows) {
    try {
      if (!row?.objectKey || !row.objectKey.includes('/draft/')) continue;
      const finalKey = buildFinalObjectKey({
        organizationId,
        conversationId,
        messageId,
        attachmentId: row._id,
        fileName: row.originalFileName || 'file'
      });
      await objectStorage.copyObject({ fromKey: row.objectKey, toKey: finalKey });
      await objectStorage.deleteObject({ key: row.objectKey });
      row.objectKey = finalKey;
      row.bucket = row.bucket || objectStorage.getBucket();
    } catch {
      // ignore move errors (draft key can still be used)
    }
  }

  // Update linkage metadata (do not move object yet; move can be added later)
  await MailroomAttachment.updateMany(
    {
      organizationId,
      _id: { $in: attachmentIds }
    },
    {
      $set: {
        status: 'linked',
        linkedConversationId: conversationId,
        linkedMessageId: messageId
      }
    }
  );

  // Persist any moved keys
  for (const row of rows) {
    try {
      if (!row?.objectKey) continue;
      await MailroomAttachment.updateOne(
        { _id: row._id, organizationId },
        { $set: { objectKey: row.objectKey, bucket: row.bucket } }
      );
    } catch {
      // ignore
    }
  }

  return rows.map((r) => r._id);
}

module.exports = {
  createUploadedAttachment,
  resolveAndLinkAttachments,
  buildFinalObjectKey,
  buildDraftObjectKey
};

