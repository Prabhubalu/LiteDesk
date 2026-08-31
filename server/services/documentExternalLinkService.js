'use strict';

const Document = require('../models/Document');

const CHECK_TIMEOUT_MS = Math.min(
  30000,
  Math.max(3000, parseInt(process.env.DOCUMENT_EXTERNAL_LINK_CHECK_TIMEOUT_MS || '10000', 10))
);

function isExternalLinkDocument(doc) {
  if (!doc) return false;
  return doc.documentType === 'external_link' || doc.sourceType === 'external';
}

async function probeExternalUrl(url) {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) {
    return { available: false, statusCode: null, reason: 'missing_url' };
  }

  let parsed;
  try {
    parsed = new URL(normalizedUrl);
  } catch {
    return { available: false, statusCode: null, reason: 'invalid_url' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { available: false, statusCode: null, reason: 'unsupported_protocol' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    let response = await fetch(normalizedUrl, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Arivu-DocumentLinkChecker/1.0' }
    });

    if (response.status === 405 || response.status === 501) {
      response = await fetch(normalizedUrl, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'Arivu-DocumentLinkChecker/1.0' }
      });
    }

    const statusCode = response.status;
    if (statusCode >= 400) {
      return { available: false, statusCode, reason: 'http_error' };
    }
    return { available: true, statusCode, reason: null };
  } catch (error) {
    return {
      available: false,
      statusCode: null,
      reason: error?.name === 'AbortError' ? 'timeout' : 'network_error'
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkDocumentExternalLink({ organizationId, documentId, userId }) {
  const doc = await Document.findOne({
    _id: documentId,
    organizationId,
    deletedAt: null
  }).lean();

  if (!doc) throw new Error('Document not found');
  if (!isExternalLinkDocument(doc)) {
    throw new Error('Document is not an external link');
  }

  const probe = await probeExternalUrl(doc.externalUrl);
  const externalLinkStatus = probe.available ? 'available' : 'unavailable';

  await Document.updateOne(
    { _id: documentId, organizationId },
    {
      $set: {
        externalLinkStatus,
        modifiedBy: userId
      }
    }
  );

  const DocumentAuditEvent = require('../models/DocumentAuditEvent');
  await DocumentAuditEvent.create({
    organizationId,
    documentId,
    action: 'update',
    actorId: userId,
    metadata: {
      action: 'external_link_check',
      externalLinkStatus,
      statusCode: probe.statusCode,
      reason: probe.reason
    },
    timestamp: new Date()
  });

  return {
    externalLinkStatus,
    statusCode: probe.statusCode,
    reason: probe.reason
  };
}

module.exports = {
  isExternalLinkDocument,
  probeExternalUrl,
  checkDocumentExternalLink
};
