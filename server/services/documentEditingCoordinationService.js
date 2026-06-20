'use strict';

/**
 * Editing coordination: presence (native docs), reservations (editable files), version conflicts.
 */

const Document = require('../models/Document');
const DocumentVersionConflict = require('../models/DocumentVersionConflict');
const DocumentAuditEvent = require('../models/DocumentAuditEvent');
const Notification = require('../models/Notification');
const recordPresenceService = require('./recordPresenceService');
const {
  DEFAULT_RESERVATION_HOURS,
  isNativeDocument,
  supportsReservation,
  resolveReservationState
} = require('../constants/documentEditingCoordination');

const USER_POPULATE = 'firstName lastName email avatar username';

class DocumentReservationError extends Error {
  constructor(message, { statusCode = 409, code, reservedBy } = {}) {
    super(message);
    this.name = 'DocumentReservationError';
    this.statusCode = statusCode;
    this.code = code;
    this.reservedBy = reservedBy;
  }
}

class DocumentVersionConflictError extends Error {
  constructor(message, { statusCode = 409, conflictId, baseVersion, currentVersion } = {}) {
    super(message);
    this.name = 'DocumentVersionConflictError';
    this.statusCode = statusCode;
    this.conflictId = conflictId;
    this.baseVersion = baseVersion;
    this.currentVersion = currentVersion;
  }
}

function resolveReservedUserId(doc) {
  if (!doc?.reservedBy) return null;
  if (typeof doc.reservedBy === 'object') {
    return doc.reservedBy._id || doc.reservedBy;
  }
  return doc.reservedBy;
}

function getReservationDurationMs(hours = DEFAULT_RESERVATION_HOURS) {
  return hours * 60 * 60 * 1000;
}

async function logCoordinationAudit({ organizationId, documentId, action, actorId, metadata = {} }) {
  await DocumentAuditEvent.create({
    organizationId,
    documentId,
    action,
    actorId,
    metadata,
    timestamp: new Date()
  });
}

async function sendCoordinationNotification({
  userId,
  organizationId,
  eventType,
  title,
  message,
  metadata = {}
}) {
  await Notification.create({
    userId,
    organizationId,
    appKey: 'PLATFORM',
    sourceAppKey: 'PLATFORM',
    eventType,
    title,
    message,
    metadata,
    channels: { inApp: true, email: false, push: false }
  });
}

async function clearExpiredReservation(doc) {
  if (!doc?.reservedBy) return doc;
  const state = resolveReservationState(doc);
  if (state !== 'expired') return doc;

  doc.reservationStatus = 'expired';
  await doc.save();
  return doc;
}

async function reserveDocument({
  organizationId,
  documentId,
  userId,
  reason = ''
}) {
  const doc = await Document.findOne({ _id: documentId, organizationId, deletedAt: null });
  if (!doc) throw new Error('Document not found');
  if (!supportsReservation(doc)) {
    throw new Error('This document type does not support reservations');
  }

  await clearExpiredReservation(doc);

  const state = resolveReservationState(doc);
  const reservedBy = resolveReservedUserId(doc);

  if (state === 'reserved' && reservedBy && String(reservedBy) !== String(userId)) {
    throw new DocumentReservationError('Document is reserved by another user', {
      statusCode: 409,
      code: 'DOCUMENT_RESERVED',
      reservedBy
    });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + getReservationDurationMs());

  doc.reservationStatus = 'reserved';
  doc.reservedBy = userId;
  doc.reservedAt = now;
  doc.reservationExpiresAt = expiresAt;
  doc.reservationReason = String(reason || '').trim() || null;
  doc.modifiedBy = userId;
  await doc.save();

  await logCoordinationAudit({
    organizationId,
    documentId,
    action: 'reservation_created',
    actorId: userId,
    metadata: { expiresAt, reason: doc.reservationReason }
  });

  return doc;
}

async function releaseReservation({ organizationId, documentId, userId, force = false }) {
  const doc = await Document.findOne({ _id: documentId, organizationId, deletedAt: null });
  if (!doc) throw new Error('Document not found');

  const reservedBy = resolveReservedUserId(doc);
  if (!reservedBy) {
    doc.reservationStatus = 'available';
    await doc.save();
    return doc;
  }

  if (!force && String(reservedBy) !== String(userId)) {
    throw new DocumentReservationError('Only the user who reserved the document can release it', {
      statusCode: 409,
      code: 'DOCUMENT_RESERVED',
      reservedBy
    });
  }

  doc.reservationStatus = 'available';
  doc.reservedBy = null;
  doc.reservedAt = null;
  doc.reservationExpiresAt = null;
  doc.reservationReason = null;
  doc.modifiedBy = userId;
  await doc.save();

  await logCoordinationAudit({
    organizationId,
    documentId,
    action: 'reservation_released',
    actorId: userId,
    metadata: { forced: Boolean(force) }
  });

  return doc;
}

async function takeoverReservation({ organizationId, documentId, userId, reason = '' }) {
  const doc = await Document.findOne({ _id: documentId, organizationId, deletedAt: null });
  if (!doc) throw new Error('Document not found');
  if (!supportsReservation(doc)) {
    throw new Error('This document type does not support reservations');
  }

  const previousReserver = resolveReservedUserId(doc);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + getReservationDurationMs());

  doc.reservationStatus = 'reserved';
  doc.reservedBy = userId;
  doc.reservedAt = now;
  doc.reservationExpiresAt = expiresAt;
  doc.reservationReason = String(reason || '').trim() || null;
  doc.modifiedBy = userId;
  await doc.save();

  await logCoordinationAudit({
    organizationId,
    documentId,
    action: 'reservation_taken_over',
    actorId: userId,
    metadata: {
      previousReserverId: previousReserver ? String(previousReserver) : null,
      expiresAt
    }
  });

  if (previousReserver && String(previousReserver) !== String(userId)) {
    await sendCoordinationNotification({
      userId: previousReserver,
      organizationId,
      eventType: 'document_reservation_taken_over',
      title: 'Reservation taken over',
      message: `Another user took over your reservation on "${doc.title}".`,
      metadata: { documentId: String(documentId), takenOverBy: String(userId) }
    });
  }

  return doc;
}

async function notifyReservationHolder({ organizationId, documentId, userId }) {
  const doc = await Document.findOne({ _id: documentId, organizationId, deletedAt: null })
    .select('title reservedBy reservationStatus reservationExpiresAt')
    .lean();
  if (!doc) throw new Error('Document not found');

  const reservedBy = doc.reservedBy;
  if (!reservedBy || resolveReservationState(doc) !== 'reserved') {
    throw new Error('Document is not currently reserved');
  }
  if (String(reservedBy) === String(userId)) {
    throw new Error('You already hold this reservation');
  }

  await sendCoordinationNotification({
    userId: reservedBy,
    organizationId,
    eventType: 'document_reservation_notify',
    title: 'Editing requested',
    message: `A teammate requested access to "${doc.title}" that you have reserved.`,
    metadata: { documentId: String(documentId), requestedBy: String(userId) }
  });

  return { notified: true };
}

async function listDocumentPresence({ organizationId, documentId }) {
  return recordPresenceService.listRecordPresence({
    organizationId,
    moduleKey: 'documents',
    recordId: documentId
  });
}

async function heartbeatPresence({
  organizationId,
  documentId,
  userId,
  activityType = 'viewing'
}) {
  const doc = await Document.findOne({ _id: documentId, organizationId, deletedAt: null })
    .select('documentType')
    .lean();
  if (!doc) throw new Error('Document not found');
  if (!isNativeDocument(doc)) {
    throw new Error('Presence is only supported for native documents');
  }

  const existing = await recordPresenceService.getRecordPresenceSession({
    organizationId,
    moduleKey: 'documents',
    recordId: documentId,
    userId
  });

  const session = await recordPresenceService.heartbeatRecordPresence({
    organizationId,
    moduleKey: 'documents',
    recordId: documentId,
    userId,
    activityType
  });

  const nextActivity = session?.activityType || activityType;
  if (!existing || existing.activityType !== nextActivity) {
    await logCoordinationAudit({
      organizationId,
      documentId,
      action: 'presence_detected',
      actorId: userId,
      metadata: { activityType: nextActivity }
    });
  }

  return session;
}

async function clearPresence({ organizationId, documentId, userId }) {
  await recordPresenceService.clearRecordPresence({
    organizationId,
    moduleKey: 'documents',
    recordId: documentId,
    userId
  });
}

function assertNoVersionConflict({ baseVersion, currentVersion, forceUpload = false }) {
  if (forceUpload) return;
  const base = parseInt(String(baseVersion), 10);
  const current = parseInt(String(currentVersion), 10);
  if (!Number.isFinite(base) || base <= 0) return;
  if (base === current) return;

  throw new DocumentVersionConflictError('A newer version of this document already exists', {
    statusCode: 409,
    baseVersion: base,
    currentVersion: current
  });
}

async function recordVersionConflict({
  organizationId,
  documentId,
  userId,
  baseVersion,
  currentVersion
}) {
  const conflict = await DocumentVersionConflict.create({
    organizationId,
    documentId,
    baseVersion,
    currentVersion,
    uploadedBy: userId,
    resolution: 'pending'
  });

  await logCoordinationAudit({
    organizationId,
    documentId,
    action: 'version_conflict_detected',
    actorId: userId,
    metadata: { baseVersion, currentVersion, conflictId: String(conflict._id) }
  });

  return conflict;
}

async function resolveVersionConflict({
  organizationId,
  documentId,
  conflictId,
  userId,
  resolution
}) {
  const conflict = await DocumentVersionConflict.findOne({
    _id: conflictId,
    organizationId,
    documentId
  });
  if (!conflict) throw new Error('Conflict not found');

  const normalized = resolution === 'create_anyway' ? 'create_anyway' : 'cancelled';
  conflict.resolution = normalized;
  conflict.resolvedBy = userId;
  await conflict.save();

  await logCoordinationAudit({
    organizationId,
    documentId,
    action: normalized === 'create_anyway' ? 'version_conflict_resolved' : 'version_conflict_cancelled',
    actorId: userId,
    metadata: {
      conflictId: String(conflict._id),
      baseVersion: conflict.baseVersion,
      currentVersion: conflict.currentVersion,
      resolution: normalized
    }
  });

  return conflict;
}

async function listVersionConflicts({ organizationId, documentId, limit = 20 }) {
  return DocumentVersionConflict.find({ organizationId, documentId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('uploadedBy', USER_POPULATE)
    .populate('resolvedBy', USER_POPULATE)
    .lean();
}

async function expireReservationsForOrganization(organizationId) {
  const now = new Date();
  const expiredDocs = await Document.find({
    organizationId,
    deletedAt: null,
    reservedBy: { $ne: null },
    reservationExpiresAt: { $lt: now }
  }).select('_id title reservedBy');

  let expired = 0;
  for (const doc of expiredDocs) {
    const reserverId = doc.reservedBy;
    await Document.updateOne(
      { _id: doc._id },
      {
        $set: {
          reservationStatus: 'available',
          reservedBy: null,
          reservedAt: null,
          reservationExpiresAt: null,
          reservationReason: null
        }
      }
    );

    await logCoordinationAudit({
      organizationId,
      documentId: doc._id,
      action: 'reservation_expired',
      actorId: reserverId,
      metadata: { title: doc.title }
    });

    if (reserverId) {
      await sendCoordinationNotification({
        userId: reserverId,
        organizationId,
        eventType: 'document_reservation_expired',
        title: 'Reservation expired',
        message: `Your reservation on "${doc.title}" has expired.`,
        metadata: { documentId: String(doc._id) }
      });
    }
    expired += 1;
  }

  return expired;
}

function formatCoordinationAuditMessage(audit) {
  const action = String(audit?.action || '').trim();
  const meta = audit?.metadata || {};
  const map = {
    reservation_created: 'Reservation created',
    reservation_released: 'Reservation released',
    reservation_expired: 'Reservation expired',
    reservation_taken_over: 'Reservation taken over',
    presence_detected: meta.activityType ? `Presence: ${meta.activityType}` : 'Presence detected',
    version_conflict_detected: `Version conflict detected (v${meta.baseVersion} → v${meta.currentVersion})`,
    version_conflict_resolved: 'Version conflict resolved',
    version_conflict_cancelled: 'Version upload cancelled due to conflict'
  };
  return map[action] || `Document ${action || 'updated'}`;
}

module.exports = {
  DocumentReservationError,
  DocumentVersionConflictError,
  resolveReservedUserId,
  resolveReservationState,
  reserveDocument,
  releaseReservation,
  takeoverReservation,
  notifyReservationHolder,
  listDocumentPresence,
  heartbeatPresence,
  clearPresence,
  assertNoVersionConflict,
  recordVersionConflict,
  resolveVersionConflict,
  listVersionConflicts,
  expireReservationsForOrganization,
  formatCoordinationAuditMessage
};
