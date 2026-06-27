'use strict';

/**
 * SecurityEvent types for portal / external user lifecycle.
 * @see docs/architecture/EXTERNAL_USER_PORTAL_FRAMEWORK.md
 */

const PORTAL_SECURITY_EVENT_TYPES = Object.freeze([
  'portal_enabled',
  'portal_disabled',
  'portal_login',
  'portal_login_failed',
  'portal_logout',
  'portal_role_assigned',
  'portal_role_removed',
  'portal_selected',
  'portal_switched',
  'portal_invite_sent',
  'portal_password_reset',
  'portal_sessions_terminated',
  'portal_user_activated',
  'portal_user_deactivated'
]);

const PORTAL_SECURITY_EVENT_TYPE_SET = new Set(PORTAL_SECURITY_EVENT_TYPES);

function isPortalSecurityEventType(type) {
  return PORTAL_SECURITY_EVENT_TYPE_SET.has(String(type || '').trim());
}

module.exports = {
  PORTAL_SECURITY_EVENT_TYPES,
  PORTAL_SECURITY_EVENT_TYPE_SET,
  isPortalSecurityEventType
};
