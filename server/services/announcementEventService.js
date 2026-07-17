'use strict';

const { emit: emitDomainEvent } = require('./domainEvents');
const domainEvents = require('../constants/domainEvents');

function emitAnnouncementDomainEvent({
  organizationId,
  announcementId,
  eventType,
  triggeredBy = null,
  metadata = {},
  currentState = null,
}) {
  try {
    emitDomainEvent({
      entityType: 'announcement',
      entityId: String(announcementId),
      eventType,
      appKey: 'PLATFORM',
      organizationId,
      triggeredBy,
      metadata,
      previousState: null,
      currentState: currentState || metadata,
      changedFields: [],
    });
  } catch (err) {
    console.warn('[announcementEventService] emit failed', {
      eventType,
      announcementId: String(announcementId),
      error: err?.message,
    });
  }
}

function emitAnnouncementPublished({ organizationId, announcementId, triggeredBy, announcement }) {
  const state = {
    announcementId: String(announcementId),
    title: announcement?.title || null,
    displayType: announcement?.displayType || null,
    status: announcement?.status || 'published',
  };
  emitAnnouncementDomainEvent({
    organizationId,
    announcementId,
    eventType: domainEvents.ANNOUNCEMENT_PUBLISHED,
    triggeredBy,
    metadata: state,
    currentState: state,
  });
  emitAnnouncementDomainEvent({
    organizationId,
    announcementId,
    eventType: 'announcement.created',
    triggeredBy,
    metadata: state,
    currentState: state,
  });
}

function emitAnnouncementAcknowledged({ organizationId, announcementId, userId }) {
  const state = {
    announcementId: String(announcementId),
    userId: userId ? String(userId) : null,
  };
  emitAnnouncementDomainEvent({
    organizationId,
    announcementId,
    eventType: domainEvents.ANNOUNCEMENT_ACKNOWLEDGED,
    triggeredBy: userId,
    metadata: state,
    currentState: state,
  });
}

function emitAnnouncementCtaClicked({ organizationId, announcementId, userId, ctaId }) {
  const state = {
    announcementId: String(announcementId),
    userId: userId ? String(userId) : null,
    ctaId: ctaId || null,
  };
  emitAnnouncementDomainEvent({
    organizationId,
    announcementId,
    eventType: domainEvents.ANNOUNCEMENT_CTA_CLICKED,
    triggeredBy: userId,
    metadata: state,
    currentState: state,
  });
}

module.exports = {
  emitAnnouncementPublished,
  emitAnnouncementAcknowledged,
  emitAnnouncementCtaClicked,
};
