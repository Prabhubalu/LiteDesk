/**
 * Announcements & Alerts — enums and defaults.
 * @see docs/ANNOUNCEMENTS_ALERTS_ADDON_ROADMAP.md
 */

const ANNOUNCEMENT_DISPLAY_TYPES = ['banner', 'popover'];

const ANNOUNCEMENT_PRIORITIES = [
  'critical',
  'high',
  'medium',
  'low',
  'information',
];

/** Persisted statuses. "active" is computed at query time. */
const ANNOUNCEMENT_STATUSES = [
  'draft',
  'scheduled',
  'published',
  'paused',
  'expired',
  'archived',
];

const ANNOUNCEMENT_TRIGGERS = [
  'immediate',
  'scheduled',
  'first_login',
  'every_login',
  'daily',
  'weekly',
  'once_per_user',
  'until_dismissed',
  'until_acknowledged',
  'until_expiry',
  'process_flow',
  'workflow',
];

const ANNOUNCEMENT_CTA_ACTION_TYPES = [
  'internal_route',
  'external_url',
  'module',
  'dashboard',
  'report',
  'kb',
  'blog',
];

const ANNOUNCEMENT_SOURCE_KINDS = [
  'manual',
  'process_flow',
  'workflow',
  'system_subscription',
  'system_trial',
];

const ANNOUNCEMENT_AUDIENCE_MODES = ['everyone', 'segment'];

const ANNOUNCEMENT_DEFAULT_SETTINGS = {
  defaultTimezone: 'UTC',
  autoArchiveExpired: true,
  receivePlatformAnnouncements: true,
  defaultDismissible: true,
  allowedSurfaces: ['web_app', 'portal'],
};

module.exports = {
  ANNOUNCEMENT_DISPLAY_TYPES,
  ANNOUNCEMENT_PRIORITIES,
  ANNOUNCEMENT_STATUSES,
  ANNOUNCEMENT_TRIGGERS,
  ANNOUNCEMENT_CTA_ACTION_TYPES,
  ANNOUNCEMENT_SOURCE_KINDS,
  ANNOUNCEMENT_AUDIENCE_MODES,
  ANNOUNCEMENT_DEFAULT_SETTINGS,
};
