'use strict';

const Deal = require('../models/Deal');
const Task = require('../models/Task');
const Case = require('../models/Case');
const Event = require('../models/Event');

const MAX_SIGNALS_PER_APP = 3;
const CLOSE_SOON_DAYS = 14;
const STALE_DAYS = 14;

const APP_LABELS = {
  SALES: 'Sales',
  HELPDESK: 'Helpdesk',
  AUDIT: 'Audit',
  PORTAL: 'Portal',
  PROJECTS: 'Projects'
};

const APP_DASHBOARD_ROUTES = {
  SALES: '/dashboard/sales',
  HELPDESK: '/helpdesk/cases',
  AUDIT: '/audit/dashboard',
  PORTAL: '/portal/dashboard',
  PROJECTS: '/projects/projects'
};

const OPEN_CASE_STATUSES = ['New', 'Assigned', 'In Progress', 'On Hold', 'Waiting for Customer'];
const CLOSED_TASK_STATUSES = ['completed', 'cancelled'];

const MANAGER_ROLE_KEYS = new Set(['ADMIN', 'MANAGER', 'OWNER']);

/**
 * Per-app and platform role hints for pulse scoping.
 */
function resolveRoleContext(req) {
  const user = req.user || {};
  const appRoles = {};
  for (const entry of user.appAccess || []) {
    if (entry?.appKey && entry.status !== 'DISABLED') {
      appRoles[String(entry.appKey).toUpperCase()] = String(entry.roleKey || '').toUpperCase();
    }
  }
  return {
    isOwner: Boolean(user.isOwner),
    legacyRole: String(user.role || '').toLowerCase(),
    appRoles
  };
}

function hasManagerScope(appKey, ctx) {
  if (ctx.isOwner) return true;
  if (ctx.legacyRole === 'owner' || ctx.legacyRole === 'admin') return true;
  return MANAGER_ROLE_KEYS.has(ctx.appRoles[appKey]);
}

/**
 * Resolve app keys the user can see on platform home.
 */
function resolveEnabledAppKeys(req) {
  const userApps = (req.user?.allowedApps || [])
    .map((key) => String(key).toUpperCase())
    .filter((key) => key && key !== 'CONTROL_PLANE');

  const orgApps = (req.organization?.enabledApps || [])
    .map((entry) => {
      if (typeof entry === 'string') return entry.toUpperCase();
      if (entry?.appKey && entry?.status !== 'INACTIVE') return String(entry.appKey).toUpperCase();
      return null;
    })
    .filter(Boolean);

  const base = userApps.length > 0 ? userApps : orgApps;
  const unique = [...new Set(base)].filter((key) => key !== 'CONTROL_PLANE');

  if (orgApps.length === 0) return unique;

  return unique.filter((key) => orgApps.includes(key));
}

function buildPulse(appKey, signals) {
  const upper = String(appKey).toUpperCase();
  const trimmed = (signals || []).slice(0, MAX_SIGNALS_PER_APP);
  return {
    appKey: upper,
    name: APP_LABELS[upper] || upper,
    route: APP_DASHBOARD_ROUTES[upper] || '/dashboard',
    signals: trimmed.length > 0 ? trimmed : [
      {
        text: 'No urgent items',
        severity: 'info',
        route: APP_DASHBOARD_ROUTES[upper] || '/dashboard'
      }
    ]
  };
}

async function getSalesPulse(organizationId, userId, roleContext) {
  const now = new Date();
  const closeSoonCutoff = new Date(now.getTime() + CLOSE_SOON_DAYS * 24 * 60 * 60 * 1000);
  const staleCutoff = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000);
  const teamView = hasManagerScope('SALES', roleContext);

  const openDealFilter = {
    organizationId,
    deletedAt: null,
    status: { $in: ['Open', 'Active'] }
  };
  if (!teamView) {
    openDealFilter.assignedTo = userId;
  }

  const [closingSoon, staleCount, overdueFollowUps] = await Promise.all([
    Deal.countDocuments({
      ...openDealFilter,
      expectedCloseDate: { $gte: now, $lte: closeSoonCutoff }
    }),
    Deal.countDocuments({
      ...openDealFilter,
      updatedAt: { $lt: staleCutoff }
    }),
    Deal.countDocuments({
      ...openDealFilter,
      nextFollowUpDate: { $lt: now }
    })
  ]);

  const signals = [];
  if (closingSoon > 0) {
    signals.push({
      signalKey: 'deals_closing_soon',
      text: teamView
        ? `${closingSoon} team deal${closingSoon !== 1 ? 's' : ''} closing soon`
        : `${closingSoon} deal${closingSoon !== 1 ? 's' : ''} closing soon`,
      severity: 'info',
      route: '/deals'
    });
  }
  if (staleCount > 0) {
    signals.push({
      signalKey: 'deals_stale',
      text: teamView ? `${staleCount} stale team-wide` : `${staleCount} stale in pipeline`,
      severity: 'warning',
      route: '/deals'
    });
  }
  if (overdueFollowUps > 0) {
    signals.push({
      signalKey: 'deals_overdue_followup',
      text: `${overdueFollowUps} overdue follow-up${overdueFollowUps !== 1 ? 's' : ''}`,
      severity: 'danger',
      route: '/deals'
    });
  }

  return buildPulse('SALES', signals);
}

async function getHelpdeskPulse(organizationId, userId, roleContext) {
  const now = new Date();
  const slaWarningCutoff = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const teamView = hasManagerScope('HELPDESK', roleContext);

  const openBase = {
    organizationId,
    deletedAt: null,
    status: { $in: OPEN_CASE_STATUSES }
  };
  if (!teamView) {
    openBase.assignedTo = userId;
  }

  const [openAssigned, slaAtRisk] = await Promise.all([
    Case.countDocuments(openBase),
    Case.countDocuments({
      ...openBase,
      'currentSlaCycle.status': { $in: ['running', 'paused'] },
      'currentSlaCycle.resolutionTargetAt': { $ne: null, $lte: slaWarningCutoff }
    })
  ]);

  const signals = [];
  if (openAssigned > 0) {
    signals.push({
      signalKey: 'cases_open',
      text: teamView
        ? `${openAssigned} open case${openAssigned !== 1 ? 's' : ''} team-wide`
        : `${openAssigned} open case${openAssigned !== 1 ? 's' : ''} assigned`,
      severity: 'info',
      route: '/helpdesk/cases'
    });
  }
  if (slaAtRisk > 0) {
    signals.push({
      signalKey: 'cases_sla_at_risk',
      text: `${slaAtRisk} SLA at risk`,
      severity: 'danger',
      route: '/helpdesk/cases'
    });
  }

  return buildPulse('HELPDESK', signals);
}

async function getAuditPulse(organizationId, userId, roleContext) {
  const now = new Date();
  const startingSoonCutoff = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const teamView = hasManagerScope('AUDIT', roleContext);

  const auditEventTypes = ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'];
  const base = {
    organizationId,
    eventType: { $in: auditEventTypes },
    status: { $nin: ['Completed', 'Cancelled'] }
  };

  const startingSoonQuery = {
    ...base,
    startDateTime: { $gte: now, $lte: startingSoonCutoff },
    auditState: { $in: ['Ready to start', 'Planned', null] }
  };
  if (!teamView) {
    startingSoonQuery.$or = [{ auditorId: userId }, { assignedTo: userId }];
  }

  const reviewQuery = {
    ...base,
    auditState: { $in: ['needs_review', 'submitted'] }
  };
  if (!teamView) {
    reviewQuery.reviewerId = userId;
  }

  const [startingSoon, needsReview] = await Promise.all([
    Event.countDocuments(startingSoonQuery),
    Event.countDocuments(reviewQuery)
  ]);

  const signals = [];
  if (startingSoon > 0) {
    signals.push({
      signalKey: 'audits_starting_soon',
      text: `${startingSoon} audit${startingSoon !== 1 ? 's' : ''} starting soon`,
      severity: 'warning',
      route: '/audit/audits'
    });
  }
  if (needsReview > 0) {
    signals.push({
      signalKey: 'audits_needs_review',
      text: `${needsReview} need${needsReview === 1 ? 's' : ''} review`,
      severity: 'danger',
      route: '/audit/audits'
    });
  }

  return buildPulse('AUDIT', signals);
}

const PULSE_BUILDERS = {
  SALES: getSalesPulse,
  HELPDESK: getHelpdeskPulse,
  AUDIT: getAuditPulse
};

/**
 * Lightweight per-app signals for platform home (max 3 per app).
 */
async function getAppPulses(req) {
  const organizationId = req.user.organizationId;
  const userId = req.user._id;
  const appKeys = resolveEnabledAppKeys(req);
  const roleContext = resolveRoleContext(req);

  const pulses = await Promise.all(
    appKeys.map(async (appKey) => {
      const builder = PULSE_BUILDERS[appKey];
      if (!builder) return null;
      try {
        return await builder(organizationId, userId, roleContext);
      } catch (err) {
        console.error(`[AppPulse] ${appKey} error:`, err.message);
        return buildPulse(appKey, []);
      }
    })
  );

  return pulses.filter(Boolean);
}

module.exports = {
  getAppPulses,
  resolveEnabledAppKeys,
  APP_DASHBOARD_ROUTES
};
