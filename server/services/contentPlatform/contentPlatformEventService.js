'use strict';

const crypto = require('crypto');
const { emit: emitDomainEvent } = require('../domainEvents');
const { CONTENT_PLATFORM_EVENT_TYPES } = require('../../constants/contentPlatformEvents');
const ContentAuditLog = require('../../models/ContentAuditLog');

/**
 * @param {string} eventType
 * @param {object} payload
 */
function emitContentPlatformEvent(eventType, payload) {
  emitDomainEvent({
    entityType: payload.entityType || 'content_template',
    entityId: payload.entityId,
    eventType,
    previousState: payload.previousState ?? null,
    currentState: payload.currentState ?? null,
    organizationId: payload.organizationId,
    triggeredBy: payload.triggeredBy ?? null,
    appKey: 'PLATFORM'
  });
}

/**
 * @param {object} params
 */
async function writeContentAuditLog(params) {
  const {
    organizationId,
    action,
    entityType,
    entityId,
    userId = null,
    before = null,
    after = null,
    metadata = {},
    ipAddress = null
  } = params;

  await ContentAuditLog.create({
    organizationId,
    action,
    entityType,
    entityId,
    userId,
    before,
    after,
    metadata,
    ipAddress
  });
}

function createRenderJobId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}

module.exports = {
  CONTENT_PLATFORM_EVENT_TYPES,
  emitContentPlatformEvent,
  writeContentAuditLog,
  createRenderJobId
};
