'use strict';

/**
 * AA6: System-generated trial / subscription reminders (master DB PlatformAnnouncement).
 */

const Organization = require('../models/Organization');
const TenantAddonConfiguration = require('../models/TenantAddonConfiguration');
const PlatformAnnouncement = require('../models/PlatformAnnouncement');
const PlatformAnnouncementUserState = require('../models/PlatformAnnouncementUserState');
const { ADDON_KEYS } = require('../constants/addonKeys');
const { shouldShowByCadence } = require('./announcementCadenceService');

const TEMPLATE_TRIAL = 'trial_expiry';
const TEMPLATE_SUBSCRIPTION = 'subscription_renewal';
const BILLING_PATH = '/settings?tab=billing';
const TRIAL_WINDOW_DAYS = 7;
const SUB_THRESHOLDS = [30, 15, 7, 1, 0];

function daysUntil(date, now = new Date()) {
  if (!date) return null;
  const end = new Date(date);
  if (Number.isNaN(end.getTime())) return null;
  const diffMs = end.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function trialCopy(days) {
  if (days <= 0) {
    return {
      title: 'Your trial has expired',
      shortDescription: 'Upgrade to keep using Arivu without interruption.',
      priority: 'critical',
      ctaLabel: 'Upgrade Now',
      criticalBypassOrgMute: true,
    };
  }
  const dayLabel = days === 1 ? '1 day' : `${days} days`;
  return {
    title: `Your trial expires in ${dayLabel}`,
    shortDescription: 'Upgrade today to keep your workspace running smoothly.',
    priority: days <= 2 ? 'critical' : 'high',
    ctaLabel: 'Upgrade Now',
    criticalBypassOrgMute: days <= 1,
  };
}

function subscriptionCopy(days) {
  if (days <= 0) {
    return {
      title: 'Subscription has expired',
      shortDescription: 'Renew now to restore full access for your organization.',
      priority: 'critical',
      ctaLabel: 'Renew Subscription',
      criticalBypassOrgMute: true,
    };
  }
  if (days === 1) {
    return {
      title: 'Subscription expires tomorrow',
      shortDescription: 'Renew today so your team stays productive.',
      priority: 'critical',
      ctaLabel: 'Renew Subscription',
      criticalBypassOrgMute: true,
    };
  }
  return {
    title: `Subscription expires in ${days} days`,
    shortDescription: 'Renew early to avoid any service interruption.',
    priority: days <= 7 ? 'high' : 'medium',
    ctaLabel: 'Renew Subscription',
    criticalBypassOrgMute: false,
  };
}

function nearestSubThreshold(days) {
  if (days == null) return null;
  if (days <= 0) return 0;
  return SUB_THRESHOLDS.find((t) => t > 0 && days <= t) || null;
}

async function upsertPlatformAnnouncement({
  organizationId,
  templateKey,
  sourceKind,
  remainingDays,
  copy,
  endAt,
}) {
  const now = new Date();
  const payload = {
    templateKey,
    category: 'system',
    targetMode: 'organizations',
    targetOrganizationId: organizationId,
    targetOrganizationIds: [organizationId],
    title: copy.title,
    shortDescription: copy.shortDescription,
    detailedDescription: copy.shortDescription,
    displayType: 'banner',
    priority: copy.priority,
    content: { body: copy.shortDescription, imageUrl: null, icon: null },
    ctas: [{
      id: 'primary',
      label: copy.ctaLabel,
      actionType: 'internal_route',
      target: BILLING_PATH,
      style: 'primary',
      sortOrder: 0,
    }],
    remainingDays,
    trigger: { type: 'every_login' },
    schedule: {
      startAt: now,
      endAt: endAt || null,
      timezone: 'UTC',
    },
    userBehaviour: {
      dismissible: true,
      stickyBanner: true,
      autoCloseSeconds: null,
      showOnce: false,
      showEveryLogin: true,
      showDaily: false,
      requireAcknowledgement: false,
    },
    status: 'published',
    source: { kind: sourceKind, externalRef: templateKey },
    criticalBypassOrgMute: copy.criticalBypassOrgMute === true,
    publishedAt: now,
    archivedAt: null,
  };

  const doc = await PlatformAnnouncement.findOneAndUpdate(
    { targetOrganizationId: organizationId, templateKey },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return doc;
}

async function archiveTemplate(organizationId, templateKey) {
  return PlatformAnnouncement.findOneAndUpdate(
    {
      targetOrganizationId: organizationId,
      templateKey,
      status: { $ne: 'archived' },
    },
    {
      $set: {
        status: 'archived',
        archivedAt: new Date(),
      },
    },
  );
}

async function syncTrialReminder(organization) {
  const organizationId = organization._id;
  const status = String(organization.subscription?.status || '').toLowerCase();
  if (status !== 'trial') {
    await archiveTemplate(organizationId, TEMPLATE_TRIAL);
    return { action: 'archived', reason: 'not_trial' };
  }

  const days = daysUntil(organization.subscription?.trialEndDate);
  if (days == null) {
    await archiveTemplate(organizationId, TEMPLATE_TRIAL);
    return { action: 'archived', reason: 'no_end_date' };
  }
  if (days > TRIAL_WINDOW_DAYS) {
    await archiveTemplate(organizationId, TEMPLATE_TRIAL);
    return { action: 'archived', reason: 'outside_window', days };
  }

  const copy = trialCopy(days);
  await upsertPlatformAnnouncement({
    organizationId,
    templateKey: TEMPLATE_TRIAL,
    sourceKind: 'system_trial',
    remainingDays: Math.max(0, days),
    copy,
    endAt: organization.subscription.trialEndDate,
  });
  return { action: 'upserted', days: Math.max(0, days) };
}

async function syncSubscriptionReminder(organization) {
  const organizationId = organization._id;
  const status = String(organization.subscription?.status || '').toLowerCase();

  // Active paid renewals use currentPeriodEnd; expired status shows urgency.
  if (status === 'trial') {
    await archiveTemplate(organizationId, TEMPLATE_SUBSCRIPTION);
    return { action: 'archived', reason: 'trial_uses_trial_template' };
  }

  const periodEnd = organization.subscription?.currentPeriodEnd;
  let days = daysUntil(periodEnd);
  if (status === 'expired' || status === 'cancelled') {
    days = days == null ? 0 : Math.min(0, days);
  } else if (status !== 'active') {
    await archiveTemplate(organizationId, TEMPLATE_SUBSCRIPTION);
    return { action: 'archived', reason: 'not_active' };
  }

  const threshold = nearestSubThreshold(days);
  if (threshold == null && status === 'active') {
    await archiveTemplate(organizationId, TEMPLATE_SUBSCRIPTION);
    return { action: 'archived', reason: 'outside_window', days };
  }

  const effectiveDays = status === 'expired' || status === 'cancelled' ? 0 : days;
  const copy = subscriptionCopy(effectiveDays);
  await upsertPlatformAnnouncement({
    organizationId,
    templateKey: TEMPLATE_SUBSCRIPTION,
    sourceKind: 'system_subscription',
    remainingDays: Math.max(0, effectiveDays),
    copy,
    endAt: periodEnd || null,
  });
  return { action: 'upserted', days: Math.max(0, effectiveDays) };
}

/**
 * Daily tick: upsert/archive system banners for all tenant orgs.
 */
async function tickSystemAnnouncementReminders() {
  if (process.env.ENABLE_SYSTEM_ANNOUNCEMENT_SCHEDULER === 'false') {
    return { processed: 0, trialUpserts: 0, subUpserts: 0, errors: 0 };
  }

  const orgs = await Organization.find({
    isTenant: true,
    isActive: { $ne: false },
  })
    .select('_id subscription')
    .lean();

  let processed = 0;
  let trialUpserts = 0;
  let subUpserts = 0;
  let errors = 0;

  for (const org of orgs) {
    try {
      const trial = await syncTrialReminder(org);
      const sub = await syncSubscriptionReminder(org);
      processed += 1;
      if (trial.action === 'upserted') trialUpserts += 1;
      if (sub.action === 'upserted') subUpserts += 1;
    } catch (err) {
      errors += 1;
      console.error(`[systemAnnouncement] org ${org._id}:`, err.message);
    }
  }

  return { processed, trialUpserts, subUpserts, errors };
}

function toPlatformViewModel(doc) {
  return {
    id: String(doc._id),
    title: doc.title,
    shortDescription: doc.shortDescription,
    detailedDescription: doc.detailedDescription,
    displayType: doc.displayType,
    priority: doc.priority,
    content: doc.content,
    ctas: doc.ctas || [],
    userBehaviour: doc.userBehaviour,
    schedule: {
      startAt: doc.schedule?.startAt,
      endAt: doc.schedule?.endAt,
      timezone: doc.schedule?.timezone,
    },
    ownership: { scope: 'platform' },
    source: doc.source,
    remainingDays: doc.remainingDays,
    isPlatform: true,
  };
}

function isPlatformActive(doc, now = new Date()) {
  if (doc.status !== 'published') return false;
  const start = doc.schedule?.startAt ? new Date(doc.schedule.startAt) : null;
  if (start && start > now) return false;
  // System templates remain until the daily sync archives them.
  if (String(doc.source?.kind || '').startsWith('system_')) return true;
  const end = doc.schedule?.endAt ? new Date(doc.schedule.endAt) : null;
  if (end && end <= now) return false;
  return true;
}

async function orgReceivesPlatform(organizationId, doc) {
  if (doc.criticalBypassOrgMute) return true;
  const config = await TenantAddonConfiguration.findOne({
    organizationId,
    addonKey: ADDON_KEYS.ANNOUNCEMENTS,
  }).lean();
  if (!config) return true; // system reminders default on
  if (config.settings?.receivePlatformAnnouncements === false) return false;
  return true;
}

function targetsOrganization(doc, organizationId) {
  const orgId = String(organizationId);
  if (doc.targetMode === 'all') return true;
  if (doc.targetOrganizationId && String(doc.targetOrganizationId) === orgId) return true;
  if (Array.isArray(doc.targetOrganizationIds) && doc.targetOrganizationIds.some((id) => String(id) === orgId)) {
    return true;
  }
  return false;
}

async function getActivePlatformForUser({ organizationId, user }) {
  if (!organizationId || !user?._id) return { banner: null, popover: null };

  const now = new Date();
  const candidates = await PlatformAnnouncement.find({
    status: 'published',
    $or: [
      { targetMode: 'all' },
      { targetOrganizationId: organizationId },
      { targetOrganizationIds: organizationId },
    ],
  }).lean();

  const visible = [];
  for (const doc of candidates) {
    if (!targetsOrganization(doc, organizationId)) continue;
    if (!isPlatformActive(doc, now)) continue;
    if (!(await orgReceivesPlatform(organizationId, doc))) continue;

    let state = await PlatformAnnouncementUserState.findOne({
      organizationId,
      userId: user._id,
      announcementId: doc._id,
    }).lean();

    if (!shouldShowByCadence(doc, state, now, { lastLogin: user.lastLogin || null })) {
      continue;
    }
    visible.push(doc);
  }

  const PRIORITY_RANK = {
    critical: 0, high: 1, medium: 2, low: 3, information: 4,
  };
  visible.sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9));

  const banner = visible.find((d) => d.displayType === 'banner') || null;
  const popover = visible.find((d) => d.displayType === 'popover') || null;
  return {
    banner: banner ? toPlatformViewModel(banner) : null,
    popover: popover ? toPlatformViewModel(popover) : null,
  };
}

async function ensurePlatformUserState({ organizationId, userId, announcementId }) {
  let state = await PlatformAnnouncementUserState.findOne({
    organizationId,
    userId,
    announcementId,
  });
  if (!state) {
    state = await PlatformAnnouncementUserState.create({
      organizationId,
      userId,
      announcementId,
    });
  }
  return state;
}

async function findPlatformForOrg(organizationId, announcementId) {
  const doc = await PlatformAnnouncement.findOne({
    _id: announcementId,
    status: 'published',
  });
  if (!doc) return null;
  if (!targetsOrganization(doc, organizationId)) return null;
  return doc;
}

module.exports = {
  TEMPLATE_TRIAL,
  TEMPLATE_SUBSCRIPTION,
  daysUntil,
  trialCopy,
  subscriptionCopy,
  syncTrialReminder,
  syncSubscriptionReminder,
  tickSystemAnnouncementReminders,
  getActivePlatformForUser,
  ensurePlatformUserState,
  findPlatformForOrg,
  toPlatformViewModel,
};
