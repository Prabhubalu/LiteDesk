'use strict';

const Case = require('../models/Case');
const TenantAppConfiguration = require('../models/TenantAppConfiguration');
const notificationDomainEvents = require('../constants/domainEvents');
const { emitNotification } = require('./notificationEngine');
const { resolveSlaScheduleForOrganization } = require('./helpdeskBusinessHoursService');
const {
  WARNING_THRESHOLD_PERCENT,
  computeMetricProgress,
  normalizeAlertState
} = require('./helpdeskSlaClockService');
const { processEscalationRules } = require('./helpdeskSlaEscalationService');

function toIdString(value) {
  if (value == null) return null;
  return value.toString ? value.toString() : String(value);
}

async function getOrganizationNotificationPrefs(organizationId, cache) {
  const key = toIdString(organizationId);
  if (cache.has(key)) return cache.get(key);

  const appConfig = await TenantAppConfiguration.findOne({
    organizationId,
    appKey: 'HELPDESK'
  })
    .select('settings.helpdeskExecution.notifications settings.notifications')
    .lean();
  const notifications = appConfig?.settings?.helpdeskExecution?.notifications ||
    appConfig?.settings?.notifications ||
    {};
  const prefs = {
    notifyOnSlaWarning: notifications.notifyOnSlaWarning !== false,
    notifyOnSlaBreach: notifications.notifyOnSlaBreach !== false
  };
  cache.set(key, prefs);
  return prefs;
}

async function emitCaseSlaNotification(caseRecord, eventType, metric, elapsedPercent) {
  await emitNotification({
    eventType,
    entity: {
      type: 'Case',
      id: toIdString(caseRecord?._id),
      title: caseRecord?.title || '',
      status: caseRecord?.status || '',
      priority: caseRecord?.priority || '',
      slaMetric: metric,
      elapsedPercent
    },
    organizationId: caseRecord?.organizationId || null,
    triggeredBy: null,
    sourceAppKey: 'HELPDESK'
  });
}

async function processMetricAlerts({
  caseRecord,
  metric,
  progress,
  prefs,
  alerts,
  scheduleResolution,
  rulesCache
}) {
  let changed = false;
  const warningKey = metric === 'response' ? 'responseWarningNotifiedAt' : 'resolutionWarningNotifiedAt';
  const breachKey = metric === 'response' ? 'responseBreachNotifiedAt' : 'resolutionBreachNotifiedAt';
  const counts = { warningSent: 0, breachSent: 0, escalationsSent: 0 };

  if (progress.met || progress.elapsedPercent == null) {
    return { changed, ...counts };
  }

  if (
    prefs.notifyOnSlaWarning &&
    progress.elapsedPercent >= WARNING_THRESHOLD_PERCENT &&
    progress.elapsedPercent < 100 &&
    !alerts[warningKey]
  ) {
    await emitCaseSlaNotification(
      caseRecord,
      notificationDomainEvents.CASE_SLA_WARNING,
      metric,
      progress.elapsedPercent
    );
    alerts[warningKey] = new Date();
    counts.warningSent += 1;
    changed = true;
  }

  if (
    prefs.notifyOnSlaBreach &&
    progress.elapsedPercent >= 100 &&
    !alerts[breachKey]
  ) {
    await emitCaseSlaNotification(
      caseRecord,
      notificationDomainEvents.CASE_SLA_BREACHED,
      metric,
      progress.elapsedPercent
    );
    alerts[breachKey] = new Date();
    counts.breachSent += 1;
    changed = true;
  }

  const escalationResult = await processEscalationRules({
    caseRecord,
    metric,
    elapsedPercent: progress.elapsedPercent,
    alerts,
    organizationId: caseRecord.organizationId,
    rulesCache
  });
  if (escalationResult.executed > 0) {
    counts.escalationsSent += escalationResult.executed;
    changed = true;
  }

  return { changed, ...counts };
}

async function tickHelpdeskSlaNotifications() {
  const rows = await Case.find({
    deletedAt: null,
    status: { $nin: ['Resolved', 'Closed'] },
    'currentSlaCycle.status': { $in: ['running', 'paused'] }
  })
    .select('_id organizationId title status priority currentSlaCycle')
    .limit(500);

  const orgPrefCache = new Map();
  const scheduleCache = new Map();
  const rulesCache = new Map();
  let processed = 0;
  let warningSent = 0;
  let breachSent = 0;
  let escalationsSent = 0;

  for (const row of rows) {
    try {
      processed += 1;
      const cycle = row.currentSlaCycle;
      if (!cycle) continue;

      const orgKey = toIdString(row.organizationId);
      if (!scheduleCache.has(orgKey)) {
        scheduleCache.set(orgKey, await resolveSlaScheduleForOrganization(row.organizationId));
      }
      const scheduleResolution = scheduleCache.get(orgKey);

      const responseProgress = computeMetricProgress(cycle, 'response', scheduleResolution);
      const resolutionProgress = computeMetricProgress(cycle, 'resolution', scheduleResolution);

      const prefs = await getOrganizationNotificationPrefs(row.organizationId, orgPrefCache);
      const alerts = normalizeAlertState(cycle.policySnapshot?.alerts);
      let changed = false;

      for (const [metric, progress] of [
        ['response', responseProgress],
        ['resolution', resolutionProgress]
      ]) {
        const result = await processMetricAlerts({
          caseRecord: row,
          metric,
          progress,
          prefs,
          alerts,
          scheduleResolution,
          rulesCache
        });
        warningSent += result.warningSent;
        breachSent += result.breachSent;
        escalationsSent += result.escalationsSent;
        if (result.changed) changed = true;
      }

      if (changed) {
        row.currentSlaCycle.policySnapshot = {
          ...(row.currentSlaCycle.policySnapshot || {}),
          alerts
        };
        await row.save();
      }
    } catch (error) {
      console.error('[helpdeskSlaMonitorService] case processing failed:', error.message);
    }
  }

  return { processed, warningSent, breachSent, escalationsSent };
}

module.exports = {
  tickHelpdeskSlaNotifications
};
