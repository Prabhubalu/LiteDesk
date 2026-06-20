'use strict';

const { checkIdempotency, storeIdempotencyResult } = require('./idempotencyGuard');

const UPLOAD_CAPABILITY = 'documents.upload';
const VERSION_UPLOAD_CAPABILITY = 'documents.version_upload';

function resolveIdempotencyKey(req) {
  const header = req.headers['x-idempotency-key'];
  if (header && String(header).trim()) return String(header).trim();
  const body = req.body?.idempotencyKey;
  if (body && String(body).trim()) return String(body).trim();
  return null;
}

async function beginDocumentUploadIdempotency(req, capabilityKey = UPLOAD_CAPABILITY) {
  const idempotencyKey = resolveIdempotencyKey(req);
  if (!idempotencyKey) {
    return { idempotencyKey: null, replay: null };
  }

  const { isDuplicate, existingResult } = await checkIdempotency(
    idempotencyKey,
    String(req.user._id),
    String(req.user.organizationId),
    capabilityKey,
    idempotencyKey
  );

  if (isDuplicate && existingResult) {
    return { idempotencyKey, replay: existingResult };
  }

  return { idempotencyKey, replay: null };
}

async function completeDocumentUploadIdempotency(req, capabilityKey, idempotencyKey, responseBody, statusCode = 201) {
  if (!idempotencyKey || !responseBody) return;
  await storeIdempotencyResult(
    idempotencyKey,
    String(req.user._id),
    String(req.user.organizationId),
    capabilityKey,
    idempotencyKey,
    { statusCode, body: responseBody }
  );
}

module.exports = {
  UPLOAD_CAPABILITY,
  VERSION_UPLOAD_CAPABILITY,
  resolveIdempotencyKey,
  beginDocumentUploadIdempotency,
  completeDocumentUploadIdempotency
};
