'use strict';

const Webform = require('../models/Webform');

const AUDIT_LOG_MAX = 50;

const AUDIT_TYPES = new Set([
  'published',
  'unpublished',
  'status_changed',
  'submission_processed',
  'dedup_hit',
  'crm_failed',
  'registry_synced'
]);

/**
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId|string} params.webformId
 * @param {import('mongoose').Types.ObjectId|string} params.organizationId
 * @param {string} params.type
 * @param {string} [params.message]
 * @param {import('mongoose').Types.ObjectId|string|null} [params.actorUserId]
 * @param {Record<string, unknown>} [params.metadata]
 */
async function appendWebformAuditEntry(params) {
  const {
    webformId,
    organizationId,
    type,
    message = '',
    actorUserId = null,
    metadata = {}
  } = params;

  if (!webformId || !organizationId || !AUDIT_TYPES.has(type)) return;

  const entry = {
    type,
    message: String(message || '').trim(),
    actorUserId: actorUserId || null,
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
    createdAt: new Date()
  };

  await Webform.updateOne(
    { _id: webformId, organizationId },
    {
      $push: {
        auditLog: {
          $each: [entry],
          $position: 0,
          $slice: AUDIT_LOG_MAX
        }
      }
    }
  );
}

module.exports = {
  AUDIT_TYPES,
  appendWebformAuditEntry
};
