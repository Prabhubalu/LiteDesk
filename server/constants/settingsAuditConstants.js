'use strict';

/** HTTP-derived audit actions for settings mutations. */
const SETTINGS_AUDIT_ACTIONS = Object.freeze(['create', 'update', 'delete', 'invoke']);

/** Known settings surfaces (extensible via string still allowed on model). */
const SETTINGS_AUDIT_SURFACES = Object.freeze([
  'settings',
  'organization',
  'security',
  'integrations',
  'addons',
  'applications',
  'automation',
  'numbering',
  'business-hours',
  'roles',
  'sharing',
  'groups',
  'users',
  'modules',
  'ai',
  'webforms',
  'notifications',
  'processes',
  'business-flows',
  'email-policy',
  'subscriptions'
]);

/** Paths / suffixes that should not produce audit rows (noise / read-side sims). */
const SETTINGS_AUDIT_SKIP_PATH_SUBSTRINGS = Object.freeze([
  '/audit-log',
  '/simulate',
  '/evaluate',
  '/preview',
  '/fill-preview',
  '/search',
  '/profile',
  '/kpis/aggregate'
]);

module.exports = {
  SETTINGS_AUDIT_ACTIONS,
  SETTINGS_AUDIT_SURFACES,
  SETTINGS_AUDIT_SKIP_PATH_SUBSTRINGS
};
