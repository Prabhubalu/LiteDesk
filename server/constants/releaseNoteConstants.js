'use strict';

const { APP_KEYS } = require('./appKeys');

/** Apps that can appear in release-note targeting (tenant-facing only). */
const RELEASE_NOTE_TARGET_APP_KEYS = [
  APP_KEYS.SALES,
  APP_KEYS.HELPDESK,
  APP_KEYS.PROJECTS,
  APP_KEYS.PORTAL,
  APP_KEYS.AUDIT,
  APP_KEYS.LMS,
  APP_KEYS.INVENTORY
];

const RELEASE_NOTE_IMPORTANCE = ['major', 'minor', 'patch'];
const RELEASE_NOTE_STATUS = ['draft', 'scheduled', 'published', 'archived'];
const RELEASE_NOTE_ITEM_TYPES = ['feature', 'improvement', 'bugfix'];
const RELEASE_NOTE_VIEW_SOURCES = ['auto_modal', 'drawer', 'help_center', 'snooze'];
const RELEASE_NOTE_TARGET_PLANS = ['trial', 'paid'];

const IMPORTANCE_RANK = {
  major: 3,
  minor: 2,
  patch: 1
};

const UNSEEN_MAX_RELEASES = 10;
const UNSEEN_LOOKBACK_DAYS = 90;
const VIEW_BATCH_MAX_IDS = 20;
const STATS_CACHE_MS = 5 * 60 * 1000;

module.exports = {
  RELEASE_NOTE_TARGET_APP_KEYS,
  RELEASE_NOTE_IMPORTANCE,
  RELEASE_NOTE_STATUS,
  RELEASE_NOTE_ITEM_TYPES,
  RELEASE_NOTE_VIEW_SOURCES,
  RELEASE_NOTE_TARGET_PLANS,
  IMPORTANCE_RANK,
  UNSEEN_MAX_RELEASES,
  UNSEEN_LOOKBACK_DAYS,
  VIEW_BATCH_MAX_IDS,
  STATS_CACHE_MS
};
