'use strict';

const domainEvents = require('./domainEvents');

/**
 * Announcements domain events exposed to Process Designer (appKey: PLATFORM).
 */
const ANNOUNCEMENTS_PROCESS_DESIGNER_TRIGGERS = Object.freeze([
  {
    eventType: domainEvents.ANNOUNCEMENT_PUBLISHED,
    label: 'Announcement published',
    entityType: 'announcement',
    appKey: 'PLATFORM',
  },
  {
    eventType: domainEvents.ANNOUNCEMENT_ACKNOWLEDGED,
    label: 'Announcement acknowledged',
    entityType: 'announcement',
    appKey: 'PLATFORM',
  },
  {
    eventType: domainEvents.ANNOUNCEMENT_CTA_CLICKED,
    label: 'Announcement CTA clicked',
    entityType: 'announcement',
    appKey: 'PLATFORM',
  },
]);

module.exports = {
  ANNOUNCEMENTS_PROCESS_DESIGNER_TRIGGERS,
};
