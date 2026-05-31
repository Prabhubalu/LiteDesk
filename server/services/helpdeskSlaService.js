'use strict';

const TenantAppConfiguration = require('../models/TenantAppConfiguration');
const {
  addBusinessMinutes,
  formatScheduleSummary
} = require('./businessHoursEngine');
const { resolveSlaScheduleForOrganization } = require('./helpdeskBusinessHoursService');

const DEFAULT_PRIORITY_TARGETS_MINUTES = {
  Low: { firstResponseMinutes: 8 * 60, resolutionMinutes: 72 * 60 },
  Medium: { firstResponseMinutes: 4 * 60, resolutionMinutes: 48 * 60 },
  High: { firstResponseMinutes: 2 * 60, resolutionMinutes: 24 * 60 },
  Critical: { firstResponseMinutes: 1 * 60, resolutionMinutes: 8 * 60 }
};

function normalizeBusinessHours(input = null) {
  const candidate = input && typeof input === 'object' ? input : {};
  const workingDays = Array.isArray(candidate.workingDays) && candidate.workingDays.length > 0
    ? candidate.workingDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [1, 2, 3, 4, 5];

  return {
    enabled: Boolean(candidate.enabled),
    scheduleSource: candidate.scheduleSource || null,
    businessHourSetId: candidate.businessHourSetId || null,
    timezone: candidate.timezone || 'UTC',
    workingDays,
    startTime: candidate.startTime || '09:00',
    endTime: candidate.endTime || '18:00'
  };
}

function normalizeTargets(targets = {}) {
  return {
    firstResponseMinutes: Number(targets.firstResponseMinutes) > 0
      ? Number(targets.firstResponseMinutes)
      : 4 * 60,
    resolutionMinutes: Number(targets.resolutionMinutes) > 0
      ? Number(targets.resolutionMinutes)
      : 48 * 60
  };
}

async function loadHelpdeskSlaConfig(organizationId) {
  try {
    const appConfig = await TenantAppConfiguration.findOne({
      organizationId,
      appKey: 'HELPDESK',
      enabled: true
    })
      .select('settings')
      .lean();

    const rootSettings = appConfig?.settings && typeof appConfig.settings === 'object'
      ? appConfig.settings
      : {};
    const settings = rootSettings.helpdeskExecution && typeof rootSettings.helpdeskExecution === 'object'
      ? rootSettings.helpdeskExecution
      : rootSettings;

    return {
      priorities: settings.slaPriorityTargets || DEFAULT_PRIORITY_TARGETS_MINUTES,
      businessHours: normalizeBusinessHours(settings.businessHours || null),
      defaultPolicyKey: settings.defaultSlaPolicyKey || null,
      policies: Array.isArray(settings.slaPolicies) ? settings.slaPolicies : [],
      escalationRules: Array.isArray(settings.escalationRules) ? settings.escalationRules : []
    };
  } catch (error) {
    console.warn('[helpdeskSlaService] Failed to load tenant SLA config. Falling back to defaults:', error.message);
    return {
      priorities: DEFAULT_PRIORITY_TARGETS_MINUTES,
      businessHours: normalizeBusinessHours(null),
      defaultPolicyKey: null,
      policies: [],
      escalationRules: []
    };
  }
}

function resolvePolicyForCase(config, { caseType, priority, channel }) {
  const policies = Array.isArray(config.policies) ? config.policies : [];
  const defaultPolicy = policies.find((p) => p?.key && p.key === config.defaultPolicyKey) || null;

  const matched = policies.find((policy) => {
    if (!policy || typeof policy !== 'object') return false;
    if (policy.enabled === false) return false;
    if (Array.isArray(policy.caseTypes) && policy.caseTypes.length > 0 && !policy.caseTypes.includes(caseType)) {
      return false;
    }
    if (Array.isArray(policy.channels) && policy.channels.length > 0 && !policy.channels.includes(channel)) {
      return false;
    }
    if (Array.isArray(policy.priorities) && policy.priorities.length > 0 && !policy.priorities.includes(priority)) {
      return false;
    }
    return true;
  }) || defaultPolicy;

  const policyPriorityTargets = matched?.priorityTargets?.[priority];
  const fallbackPriorityTargets = config.priorities?.[priority];
  const targets = normalizeTargets(policyPriorityTargets || fallbackPriorityTargets || {});

  return {
    policyKey: matched?.key || 'default',
    policyName: matched?.name || 'Default SLA Policy',
    targets
  };
}

function buildPolicySnapshot(policy, context, scheduleResolution, computedAt) {
  const { useCalendarTime, schedule, meta } = scheduleResolution;
  const snapshot = {
    key: policy.policyKey,
    name: policy.policyName,
    caseType: context.caseType,
    priority: context.priority,
    channel: context.channel,
    firstResponseMinutes: policy.targets.firstResponseMinutes,
    resolutionMinutes: policy.targets.resolutionMinutes,
    businessHours: {
      enabled: !useCalendarTime,
      mode: useCalendarTime ? 'calendar' : 'business',
      scheduleSource: meta?.source || null,
      scheduleName: meta?.name || null,
      businessHourSetId: meta?.setId || null,
      summary: useCalendarTime ? '24/7 SLA clock' : (meta?.summary || formatScheduleSummary(schedule)),
      timezone: meta?.timezone || schedule?.timezone || 'UTC'
    },
    computedAt
  };

  if (!useCalendarTime && schedule) {
    const legacyDays = [];
    for (let d = 0; d <= 6; d += 1) {
      if (schedule.weekByDay?.[d]?.enabled) legacyDays.push(d);
    }
    const sampleWindow = schedule.weekByDay?.[legacyDays[0]]?.windows?.[0];
    snapshot.businessHours.workingDays = legacyDays;
    snapshot.businessHours.startTime = sampleWindow?.start || '09:00';
    snapshot.businessHours.endTime = sampleWindow?.end || '18:00';
  } else if (useCalendarTime) {
    snapshot.businessHours.workingDays = [0, 1, 2, 3, 4, 5, 6];
    snapshot.businessHours.startTime = '00:00';
    snapshot.businessHours.endTime = '23:59';
  }

  return snapshot;
}

function addTargetsFromSchedule(startedAt, targets, scheduleResolution) {
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);
  const { useCalendarTime, schedule } = scheduleResolution;

  if (useCalendarTime || !schedule) {
    return {
      responseTargetAt: new Date(start.getTime() + targets.firstResponseMinutes * 60000),
      resolutionTargetAt: new Date(start.getTime() + targets.resolutionMinutes * 60000)
    };
  }

  return {
    responseTargetAt: addBusinessMinutes(start, targets.firstResponseMinutes, schedule),
    resolutionTargetAt: addBusinessMinutes(start, targets.resolutionMinutes, schedule)
  };
}

async function computeSlaTargetsForCase(organizationId, context, startedAt = new Date()) {
  const config = await loadHelpdeskSlaConfig(organizationId);
  const scheduleResolution = await resolveSlaScheduleForOrganization(organizationId);
  const policy = resolvePolicyForCase(config, context);
  const { responseTargetAt, resolutionTargetAt } = addTargetsFromSchedule(
    startedAt,
    policy.targets,
    scheduleResolution
  );

  return {
    responseTargetAt,
    resolutionTargetAt,
    policySnapshot: buildPolicySnapshot(policy, context, scheduleResolution, new Date())
  };
}

async function applySlaTargetsToCycle({ organizationId, cycle, context, startedAt }) {
  const effectiveStart = startedAt || cycle.startedAt || new Date();
  const targets = await computeSlaTargetsForCase(organizationId, context, effectiveStart);
  return {
    ...cycle,
    responseTargetAt: targets.responseTargetAt,
    resolutionTargetAt: targets.resolutionTargetAt,
    policySnapshot: targets.policySnapshot
  };
}

module.exports = {
  loadHelpdeskSlaConfig,
  normalizeBusinessHours,
  computeSlaTargetsForCase,
  applySlaTargetsToCycle
};
