/**
 * Audit-linked form access: auditors may read/fill forms only when the form
 * is linked to an audit event they own (same org). Used by /api/audit/forms/* routes.
 */

const mongoose = require('mongoose');
const Event = require('../models/Event');
const FormResponse = require('../models/FormResponse');

const AUDIT_EVENT_TYPES = [
    'Internal Audit',
    'External Audit',
    'External Audit — Single Org',
    'External Audit Beat'
];

function toRefIdString(value) {
    if (value == null) return null;
    if (typeof value === 'string') return value;
    if (value._id != null) return String(value._id);
    return value.toString ? value.toString() : String(value);
}

function assertUserIsAuditEventStakeholder(event, userId) {
    if (!event || !userId) return false;
    const uid = toRefIdString(userId);
    const ids = [event.eventOwnerId, event.auditorId, event.reviewerId, event.correctiveOwnerId]
        .map(toRefIdString)
        .filter(Boolean);
    return ids.includes(uid);
}

function toObjectId(value) {
    if (!value) return null;
    if (value instanceof mongoose.Types.ObjectId) return value;
    const str = typeof value === 'string' ? value : String(value);
    return mongoose.Types.ObjectId.isValid(str) ? new mongoose.Types.ObjectId(str) : null;
}

/**
 * True if the auditor owns at least one audit event in the org with this linkedFormId.
 */
async function assertAuditorLinkedFormAccess({ userId, organizationId, formId }) {
    const fid = toObjectId(formId);
    if (!fid) return false;

    const exists = await Event.exists({
        organizationId,
        eventOwnerId: userId,
        linkedFormId: fid,
        eventType: { $in: AUDIT_EVENT_TYPES },
        deletedAt: null
    });
    return Boolean(exists);
}

/**
 * True if the user is auditor, event owner, reviewer, or corrective owner for the
 * audit event linked to this response (same org, audit event types).
 */
async function assertAuditorFormResponseStakeholderAccess({ userId, organizationId, formId, responseId }) {
    const fid = toObjectId(formId);
    const rid = toObjectId(responseId);
    if (!fid || !rid) return false;

    const response = await FormResponse.findOne({
        _id: rid,
        formId: fid,
        organizationId
    })
        .select('linkedTo')
        .lean();

    if (!response || response.linkedTo?.type !== 'Event' || !response.linkedTo?.id) {
        return false;
    }

    const eventId = response.linkedTo.id;
    const event = await Event.findOne({
        _id: eventId,
        organizationId,
        eventType: { $in: AUDIT_EVENT_TYPES },
        deletedAt: null
    })
        .select('eventOwnerId auditorId reviewerId correctiveOwnerId eventType')
        .lean();

    if (!event) return false;
    return assertUserIsAuditEventStakeholder(event, userId);
}

/**
 * True if form response belongs to org, matches formId, is linked to an Event,
 * and that event is an audit owned by the user.
 */
async function assertAuditorFormResponseAccess({ userId, organizationId, formId, responseId }) {
    const fid = toObjectId(formId);
    const rid = toObjectId(responseId);
    if (!fid || !rid) return false;

    const response = await FormResponse.findOne({
        _id: rid,
        formId: fid,
        organizationId
    })
        .select('linkedTo')
        .lean();

    if (!response || response.linkedTo?.type !== 'Event' || !response.linkedTo?.id) {
        return false;
    }

    const eventId = response.linkedTo.id;
    const exists = await Event.exists({
        _id: eventId,
        organizationId,
        eventOwnerId: userId,
        eventType: { $in: AUDIT_EVENT_TYPES },
        deletedAt: null
    });
    return Boolean(exists);
}

module.exports = {
    assertAuditorLinkedFormAccess,
    assertAuditorFormResponseAccess,
    assertAuditorFormResponseStakeholderAccess,
    assertUserIsAuditEventStakeholder,
    AUDIT_EVENT_TYPES
};
