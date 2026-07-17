'use strict';

/**
 * Server-authoritative show/hide cadence for announcements.
 */

function startOfUtcDay(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * @param {object} doc - announcement lean doc
 * @param {object|null} state - AnnouncementUserState lean
 * @param {Date} [now]
 * @param {{ lastLogin?: Date|null }} [opts]
 */
function shouldShowByCadence(doc, state, now = new Date(), opts = {}) {
  const behaviour = doc.userBehaviour || {};
  const trigger = doc.trigger?.type || 'immediate';
  const dismissible = behaviour.dismissible !== false;
  const requireAck = behaviour.requireAcknowledgement === true || trigger === 'until_acknowledged';
  const lastLogin = opts.lastLogin ? new Date(opts.lastLogin) : null;
  const lastLoginValid = lastLogin && !Number.isNaN(lastLogin.getTime());

  // Acknowledgement always ends visibility for that user.
  if (state?.acknowledgedAt) return false;

  // Once-only family (view or dismiss ends it)
  if (trigger === 'once_per_user' || trigger === 'first_login' || behaviour.showOnce) {
    if ((state?.viewCount || 0) > 0 || state?.dismissedAt || state?.acknowledgedAt) {
      return false;
    }
    return true;
  }

  // Until acknowledged: only ack advances (dismiss alone should not hide)
  if (trigger === 'until_acknowledged') {
    return !state?.acknowledgedAt;
  }

  // Until dismissed
  if (trigger === 'until_dismissed') {
    if (dismissible && state?.dismissedAt) return false;
    return true;
  }

  // Every login: re-show only after a new login later than dismiss/view cycle
  if (trigger === 'every_login' || behaviour.showEveryLogin) {
    if (dismissible && state?.dismissedAt) {
      // No login timestamp, or dismiss after last login → stay hidden this session
      if (!lastLoginValid || new Date(state.dismissedAt) >= lastLogin) {
        return false;
      }
    }
    if (lastLoginValid && state?.lastShownAt) {
      if (new Date(state.lastShownAt) >= lastLogin) return false;
    } else if (!lastLoginValid && state?.lastShownAt) {
      return false;
    }
    return true;
  }

  // Daily — dismiss hides for the rest of the UTC day
  if (trigger === 'daily' || behaviour.showDaily) {
    if (dismissible && state?.dismissedAt
      && startOfUtcDay(new Date(state.dismissedAt)) === startOfUtcDay(now)) {
      return false;
    }
    if (state?.lastShownAt && startOfUtcDay(new Date(state.lastShownAt)) === startOfUtcDay(now)) {
      return false;
    }
    return true;
  }

  // Weekly — dismiss hides for 7 days from dismiss (or last shown)
  if (trigger === 'weekly') {
    if (dismissible && state?.dismissedAt
      && (now - new Date(state.dismissedAt)) < 7 * 24 * 60 * 60 * 1000) {
      return false;
    }
    if (state?.lastShownAt && (now - new Date(state.lastShownAt)) < 7 * 24 * 60 * 60 * 1000) {
      return false;
    }
    return true;
  }

  // Default (immediate / scheduled / until_expiry / automation): dismiss ends visibility
  if (dismissible && state?.dismissedAt) return false;
  return true;
}

module.exports = {
  shouldShowByCadence,
  startOfUtcDay,
};
