const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const domainEvents = require('../constants/domainEvents');
const Case = require('../models/Case');
const { emitNotification } = require('./notificationEngine');
const { pickEntityForStorage } = require('../utils/notificationEntityDisplay');
const {
  notifyCaseEmailReceived,
  notifyCaseChatMessageReceived
} = require('./caseNotificationService');

const SIMULATABLE_EVENTS = [
  domainEvents.CASE_CREATED,
  domainEvents.CASE_EMAIL_RECEIVED,
  domainEvents.CASE_CHAT_MESSAGE_RECEIVED
];

function isSimulationEnabled() {
  return (
    process.env.NODE_ENV !== 'production'
    || process.env.ENABLE_NOTIFICATION_SIMULATE === 'true'
  );
}

function sampleEntity(caseRecord) {
  if (caseRecord?._id) {
    return {
      type: 'Case',
      id: caseRecord._id,
      title: caseRecord.title || '',
      caseId: caseRecord.caseId || '',
      fromAddress: 'customer@example.com',
      subject: '[Simulated] Support request',
      preview: 'This is a simulated inbound message for testing alerts.',
      authorName: 'Simulated Visitor'
    };
  }
  const id = new mongoose.Types.ObjectId();
  return {
    type: 'Case',
    id,
    title: 'Simulated support case',
    caseId: 'SIM-TEST-001',
    fromAddress: 'customer@example.com',
    subject: '[Simulated] Support request',
    preview: 'This is a simulated inbound message for testing alerts.',
    authorName: 'Simulated Visitor'
  };
}

function copyForEvent(eventType, entity) {
  const caseLabel = entity.caseId || entity.title || 'Case';
  const titles = {
    [domainEvents.CASE_CREATED]: 'New case',
    [domainEvents.CASE_EMAIL_RECEIVED]: 'Customer email',
    [domainEvents.CASE_CHAT_MESSAGE_RECEIVED]: 'Live chat message'
  };
  const bodies = {
    [domainEvents.CASE_CREATED]: `${caseLabel} was created (simulated).`,
    [domainEvents.CASE_EMAIL_RECEIVED]: `New email on ${caseLabel} from ${entity.fromAddress}: ${entity.subject}`,
    [domainEvents.CASE_CHAT_MESSAGE_RECEIVED]: `New chat on ${caseLabel} from ${entity.authorName}: ${entity.preview}`
  };
  return {
    title: titles[eventType] || 'Case notification',
    body: bodies[eventType] || `Simulated update on ${caseLabel}.`
  };
}

async function loadCase(caseId, organizationId) {
  if (!caseId || !mongoose.isValidObjectId(caseId)) return null;
  return Case.findOne({ _id: caseId, organizationId })
    .select('caseId title status priority assignedTo organizationId')
    .lean();
}

/**
 * Deliver directly to one user (IN_APP + SSE). Tests bell, toast, and sound without recipient rules.
 */
async function simulateSelfDelivery({ userId, organizationId, eventType, caseRecord = null }) {
  const entity = sampleEntity(caseRecord);
  const copy = copyForEvent(eventType, entity);
  const doc = await Notification.create({
    userId,
    organizationId,
    appKey: 'HELPDESK',
    sourceAppKey: 'HELPDESK',
    eventType,
    title: copy.title,
    body: copy.body,
    entity: pickEntityForStorage(entity),
    channel: 'IN_APP',
    priority: 'HIGH',
    readAt: null
  });

  const { deliverNotificationSSE } = require('./notificationSSEDeliver');
  await deliverNotificationSSE({
    userId,
    organizationId,
    appKey: 'HELPDESK',
    payload: {
      id: String(doc._id),
      appKey: 'HELPDESK',
      eventType,
      title: copy.title,
      body: copy.body,
      priority: 'HIGH',
      entity,
      createdAt: doc.createdAt
    }
  });

  return {
    mode: 'self',
    notificationId: String(doc._id),
    eventType,
    title: copy.title,
    body: copy.body
  };
}

/**
 * Full pipeline (rules + recipient resolver). Use with a real caseId to test routing.
 */
async function simulatePipeline({ organizationId, eventType, caseRecord, triggeredBy = null }) {
  if (!caseRecord) {
    throw new Error('caseId is required for pipeline mode');
  }

  if (eventType === domainEvents.CASE_EMAIL_RECEIVED) {
    await notifyCaseEmailReceived(caseRecord, {
      fromAddress: 'customer@example.com',
      subject: '[Simulated] Inbound email',
      preview: 'Pipeline simulation — customer replied.'
    });
  } else if (eventType === domainEvents.CASE_CHAT_MESSAGE_RECEIVED) {
    await notifyCaseChatMessageReceived(caseRecord, {
      authorName: 'Simulated Visitor',
      preview: 'Pipeline simulation — visitor sent a chat message.'
    });
  } else if (eventType === domainEvents.CASE_CREATED) {
    await emitNotification({
      eventType: domainEvents.CASE_CREATED,
      entity: {
        type: 'Case',
        id: String(caseRecord._id),
        title: caseRecord.title || '',
        caseId: caseRecord.caseId || ''
      },
      organizationId,
      triggeredBy,
      sourceAppKey: 'HELPDESK'
    });
  } else {
    throw new Error(`Unsupported pipeline event: ${eventType}`);
  }

  return { mode: 'pipeline', eventType, caseId: String(caseRecord._id) };
}

async function simulateHelpdeskNotification({
  userId,
  organizationId,
  eventType,
  mode = 'self',
  caseId = null,
  triggeredBy = null
}) {
  if (!isSimulationEnabled()) {
    const err = new Error('Notification simulation is disabled in production');
    err.statusCode = 403;
    throw err;
  }

  if (!SIMULATABLE_EVENTS.includes(eventType)) {
    const err = new Error(`eventType must be one of: ${SIMULATABLE_EVENTS.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const caseRecord = await loadCase(caseId, organizationId);

  if (mode === 'pipeline') {
    if (!caseRecord) {
      const err = new Error('Valid caseId is required for pipeline mode');
      err.statusCode = 400;
      throw err;
    }
    return simulatePipeline({ organizationId, eventType, caseRecord, triggeredBy });
  }

  return simulateSelfDelivery({ userId, organizationId, eventType, caseRecord });
}

module.exports = {
  isSimulationEnabled,
  SIMULATABLE_EVENTS,
  simulateHelpdeskNotification
};
