const crypto = require('crypto');
const MailroomRawPayload = require('../../../models/MailroomRawPayload');

const MAX_INLINE_BYTES = 4 * 1024 * 1024;

function hashPayload(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Persist immutable inbound bytes/metadata for audit and replay (M1).
 */
async function storeRawPayload({
  organizationId,
  connectorType,
  buffer = null,
  jsonPayload = null,
  externalReference = null,
  headers = {},
  contentType = 'application/octet-stream'
}) {
  let byteSize = 0;
  let payloadBase64 = null;
  let payloadHash = null;

  if (Buffer.isBuffer(buffer) && buffer.length > 0) {
    byteSize = buffer.length;
    payloadHash = hashPayload(buffer);
    if (byteSize <= MAX_INLINE_BYTES) {
      payloadBase64 = buffer.toString('base64');
    }
  } else if (jsonPayload != null) {
    const str = typeof jsonPayload === 'string' ? jsonPayload : JSON.stringify(jsonPayload);
    const buf = Buffer.from(str, 'utf8');
    byteSize = buf.length;
    payloadHash = hashPayload(buf);
    if (byteSize <= MAX_INLINE_BYTES) {
      payloadBase64 = buf.toString('base64');
    }
    contentType = 'application/json';
  }

  const doc = await MailroomRawPayload.create({
    organizationId: organizationId || null,
    connectorType,
    externalReference,
    contentType,
    payloadBase64,
    payloadHash,
    headers,
    byteSize,
    status: 'received'
  });

  return doc;
}

async function markRawPayloadProcessed(rawPayloadId, { processingMeta = {}, communicationId = null } = {}) {
  if (!rawPayloadId) return;
  await MailroomRawPayload.updateOne(
    { _id: rawPayloadId },
    {
      $set: {
        status: 'processed',
        processedAt: new Date(),
        processingMeta,
        ...(communicationId ? { communicationId } : {})
      }
    }
  );
}

async function markRawPayloadFailed(rawPayloadId, errorMessage) {
  if (!rawPayloadId) return;
  await MailroomRawPayload.updateOne(
    { _id: rawPayloadId },
    {
      $set: {
        status: 'failed',
        lastError: String(errorMessage || '').slice(0, 2000)
      }
    }
  );
}

module.exports = {
  storeRawPayload,
  markRawPayloadProcessed,
  markRawPayloadFailed,
  MAX_INLINE_BYTES
};
