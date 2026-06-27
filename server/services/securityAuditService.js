'use strict';

/**
 * Append-only security audit writer (SecurityEvent collection).
 */

const SecurityEvent = require('../models/SecurityEvent');
const { isPortalSecurityEventType } = require('../constants/portalSecurityEventTypes');

/**
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId|string} params.organizationId
 * @param {string} params.type
 * @param {string} [params.description]
 * @param {import('mongoose').Types.ObjectId|string|null} [params.userId]
 * @param {import('mongoose').Types.ObjectId|string|null} [params.peopleId]
 * @param {import('mongoose').Types.ObjectId|string|null} [params.actorUserId]
 * @param {string|null} [params.userName]
 * @param {string|null} [params.userEmail]
 * @param {string|null} [params.ipAddress]
 * @param {string|null} [params.userAgent]
 * @param {Record<string, unknown>} [params.metadata]
 */
async function recordSecurityEvent(params) {
  const {
    organizationId,
    type,
    description = '',
    userId = null,
    peopleId = null,
    actorUserId = null,
    userName = null,
    userEmail = null,
    ipAddress = null,
    userAgent = null,
    metadata = {}
  } = params;

  if (!organizationId || !type) {
    return null;
  }

  try {
    return await SecurityEvent.create({
      organizationId,
      type,
      description: String(description || '').trim(),
      userId,
      peopleId,
      actorUserId,
      userName,
      userEmail,
      ipAddress,
      userAgent,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
      timestamp: new Date()
    });
  } catch (err) {
    console.error('[securityAuditService] recordSecurityEvent failed:', err.message);
    return null;
  }
}

/**
 * Portal-specific SecurityEvent helper.
 */
async function recordPortalEvent(params) {
  const type = String(params?.type || '');
  if (!isPortalSecurityEventType(type)) {
    console.warn('[securityAuditService] Unknown portal event type:', type);
  }
  return recordSecurityEvent(params);
}

module.exports = {
  recordSecurityEvent,
  recordPortalEvent
};
