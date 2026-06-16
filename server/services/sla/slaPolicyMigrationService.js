'use strict';

const SlaPolicy = require('../../models/SlaPolicy');
const TenantAppConfiguration = require('../../models/TenantAppConfiguration');
const { DEFAULT_SLA_POLICY_KEY } = require('../../constants/slaPolicy');

const FALLBACK_PRIORITY_TARGETS = {
  Low: { firstResponseMinutes: 8 * 60, resolutionMinutes: 72 * 60 },
  Medium: { firstResponseMinutes: 4 * 60, resolutionMinutes: 48 * 60 },
  High: { firstResponseMinutes: 2 * 60, resolutionMinutes: 24 * 60 },
  Critical: { firstResponseMinutes: 1 * 60, resolutionMinutes: 8 * 60 }
};

function buildEntryCriteriaFromLegacy(policy) {
  const clauses = [];
  if (Array.isArray(policy.caseTypes) && policy.caseTypes.length > 0) {
    clauses.push({ field: 'caseType', operator: 'in', value: [...policy.caseTypes] });
  }
  if (Array.isArray(policy.channels) && policy.channels.length > 0) {
    clauses.push({ field: 'channel', operator: 'in', value: [...policy.channels] });
  }
  if (Array.isArray(policy.priorities) && policy.priorities.length > 0) {
    clauses.push({ field: 'priority', operator: 'in', value: [...policy.priorities] });
  }
  return { combinator: 'all', clauses, groups: [] };
}

function buildTargetsFromLegacy(policy, standardTargets = {}) {
  const source = policy?.priorityTargets && typeof policy.priorityTargets === 'object'
    ? policy.priorityTargets
    : standardTargets;
  const effectiveSource = Object.keys(source).length > 0 ? source : FALLBACK_PRIORITY_TARGETS;
  const targets = [];
  for (const [priorityKey, row] of Object.entries(effectiveSource)) {
    const responseMinutes = Number(row.firstResponseMinutes) > 0
      ? Number(row.firstResponseMinutes)
      : Number(row.responseHours) > 0
        ? Number(row.responseHours) * 60
        : null;
    const resolutionMinutes = Number(row.resolutionMinutes) > 0
      ? Number(row.resolutionMinutes)
      : Number(row.resolutionHours) > 0
        ? Number(row.resolutionHours) * 60
        : null;
    if (responseMinutes) {
      targets.push({
        milestoneKey: 'first_response',
        priorityKey,
        durationMinutes: responseMinutes,
        calendarOverride: row.overrideHours || null
      });
    }
    if (resolutionMinutes) {
      targets.push({
        milestoneKey: 'resolution',
        priorityKey,
        durationMinutes: resolutionMinutes,
        calendarOverride: row.overrideHours || null
      });
    }
  }
  return targets;
}

function buildNotificationsFromLegacy(notifications = {}) {
  const rows = [];
  if (notifications.notifyOnSlaWarning !== false) {
    rows.push({ milestoneKey: null, timing: 'before', offsetMinutes: 30, recipients: ['assigned_user'], channels: ['inApp', 'email'] });
  }
  if (notifications.notifyOnSlaBreach !== false) {
    rows.push({ milestoneKey: null, timing: 'at', offsetMinutes: 0, recipients: ['assigned_user', 'manager'], channels: ['inApp', 'email'] });
  }
  return rows;
}

function mapDefaultSlaPolicy(settings) {
  const businessHours = settings.businessHours || null;
  const useCalendar = businessHours?.enabled === false;
  const enabledCaseTypes = settings.caseTypes?.enabled || settings.enabledCaseTypes || [];
  const hasCustomDefault = Boolean(settings.defaultSlaPolicyKey);

  return {
    policyKey: DEFAULT_SLA_POLICY_KEY,
    name: 'Default SLA',
    description: 'Organization-wide default SLA applied when no other policy matches.',
    active: true,
    isDefault: !hasCustomDefault,
    precedence: 0,
    scope: { appKey: 'HELPDESK', moduleKey: 'cases', recordType: null },
    entryCriteria: enabledCaseTypes.length
      ? { combinator: 'all', clauses: [{ field: 'caseType', operator: 'in', value: [...enabledCaseTypes] }], groups: [] }
      : { combinator: 'all', clauses: [], groups: [] },
    trigger: { type: 'record_created' },
    targets: buildTargetsFromLegacy(null, settings.slaPriorityTargets || {}),
    pauseConditions: [],
    resumeConditions: [],
    successCriteria: {
      combinator: 'any',
      clauses: [
        { field: 'status', operator: 'equals', value: 'Resolved' },
        { field: 'status', operator: 'equals', value: 'Closed' }
      ],
      groups: []
    },
    notifications: buildNotificationsFromLegacy(settings.notifications),
    escalations: { enabled: false, cooldownMinutes: 15, steps: [] },
    calendar: {
      mode: useCalendar ? 'calendar24x7' : 'business',
      businessHourSetId: businessHours?.businessHourSetId || null,
      inlineBusinessHours: useCalendar ? null : businessHours
    },
    advanced: { migratedFrom: 'helpdeskStandard' }
  };
}

function mapLegacyPolicy(policy, { standardTargets, defaultPolicyKey, businessHours }) {
  const useCalendar = Boolean(policy.useCalendarTime);
  return {
    policyKey: policy.key,
    name: policy.name,
    active: policy.enabled !== false,
    isDefault: policy.key === defaultPolicyKey,
    precedence: Number(policy.precedence) || 10,
    scope: { appKey: 'HELPDESK', moduleKey: 'cases', recordType: null },
    entryCriteria: buildEntryCriteriaFromLegacy(policy),
    trigger: { type: 'record_created' },
    targets: buildTargetsFromLegacy(policy, standardTargets),
    notifications: Array.isArray(policy.alerts)
      ? policy.alerts.map((alert) => ({
        milestoneKey: null,
        timing: alert.timingMode === 'immediately' ? 'at' : (alert.timingMode || 'before'),
        offsetMinutes: Number(alert.timingMinutes) || 30,
        recipients: Array.isArray(alert.recipients) ? alert.recipients : [],
        channels: Array.isArray(alert.channels) ? alert.channels : ['inApp'],
        priorityKeys: Array.isArray(alert.priorities) ? alert.priorities : []
      }))
      : [],
    escalations: {
      enabled: Array.isArray(policy.escalationSteps) && policy.escalationSteps.length > 0,
      cooldownMinutes: Number(policy.escalationCooldownMinutes) || 15,
      steps: Array.isArray(policy.escalationSteps)
        ? policy.escalationSteps.map((step) => ({
          role: step.role,
          actionType: 'notify_hierarchy',
          delayMinutes: Number(step.delayMinutes) || 0,
          config: {}
        }))
        : []
    },
    calendar: {
      mode: useCalendar ? 'calendar24x7' : 'business',
      businessHourSetId: businessHours?.businessHourSetId || null,
      inlineBusinessHours: useCalendar ? null : businessHours
    },
    advanced: { migratedFrom: 'helpdeskExecution', legacyKey: policy.key }
  };
}

async function loadHelpdeskExecutionSettings(organizationId) {
  const appConfig = await TenantAppConfiguration.findOne({
    organizationId,
    appKey: 'HELPDESK',
    enabled: true
  })
    .select('settings')
    .lean();

  const root = appConfig?.settings?.helpdeskExecution || appConfig?.settings || {};
  return {
    caseTypes: root.caseTypes || { enabled: [] },
    slaPolicies: Array.isArray(root.slaPolicies) ? root.slaPolicies : [],
    defaultSlaPolicyKey: root.defaultSlaPolicyKey || null,
    slaPriorityTargets: root.slaPriorityTargets || {},
    businessHours: root.businessHours || null,
    notifications: root.notifications || {}
  };
}

async function upsertMappedPolicy(organizationId, mapped) {
  const existing = await SlaPolicy.findOne({
    organizationId,
    policyKey: mapped.policyKey,
    deletedAt: null
  });

  if (existing) {
    Object.assign(existing, mapped);
    existing.version = (existing.version || 1) + 1;
    await existing.save();
    return 'updated';
  }

  await SlaPolicy.create({ organizationId, ...mapped });
  return 'created';
}

function targetsToLegacyPriorityTargets(targets = []) {
  const result = {};
  for (const target of targets) {
    if (!target.priorityKey) continue;
    if (!result[target.priorityKey]) {
      result[target.priorityKey] = {};
    }
    if (target.milestoneKey === 'first_response') {
      result[target.priorityKey].firstResponseMinutes = target.durationMinutes;
    }
    if (target.milestoneKey === 'resolution') {
      result[target.priorityKey].resolutionMinutes = target.durationMinutes;
    }
  }
  return result;
}

async function syncDefaultPolicyToLegacySettings(organizationId, policy) {
  if (!policy || policy.policyKey !== DEFAULT_SLA_POLICY_KEY) return;

  const slaPriorityTargets = targetsToLegacyPriorityTargets(policy.targets);
  const enabledCaseTypes = policy.entryCriteria?.clauses?.find((c) => c.field === 'caseType' && c.operator === 'in')?.value || [];

  await TenantAppConfiguration.updateOne(
    { organizationId, appKey: 'HELPDESK' },
    {
      $set: {
        'settings.helpdeskExecution.slaPriorityTargets': slaPriorityTargets,
        'settings.slaPriorityTargets': slaPriorityTargets,
        ...(Array.isArray(enabledCaseTypes) && enabledCaseTypes.length
          ? { 'settings.helpdeskExecution.caseTypes.enabled': enabledCaseTypes }
          : {})
      }
    }
  );
}

async function ensureDefaultSlaPolicy(organizationId) {
  const settings = await loadHelpdeskExecutionSettings(organizationId);
  const mapped = mapDefaultSlaPolicy(settings);
  const action = await upsertMappedPolicy(organizationId, mapped);
  return { action, policyKey: DEFAULT_SLA_POLICY_KEY };
}

async function ensureDefaultSlaPolicyForModule(organizationId, moduleKey, appKey = null) {
  const normalizedModuleKey = String(moduleKey || 'cases').toLowerCase();
  if (normalizedModuleKey === 'cases') {
    return ensureDefaultSlaPolicy(organizationId);
  }

  const existing = await SlaPolicy.findOne({
    organizationId,
    policyKey: DEFAULT_SLA_POLICY_KEY,
    'scope.moduleKey': normalizedModuleKey,
    deletedAt: null
  }).lean();

  if (existing) {
    return { action: 'exists', policyKey: DEFAULT_SLA_POLICY_KEY };
  }

  const mapped = {
    policyKey: DEFAULT_SLA_POLICY_KEY,
    name: 'Default SLA',
    description: 'Organization-wide default SLA applied when no other policy matches.',
    active: true,
    isDefault: true,
    precedence: 0,
    scope: {
      appKey: appKey ? String(appKey).toUpperCase() : null,
      moduleKey: normalizedModuleKey,
      recordType: null
    },
    entryCriteria: { combinator: 'all', clauses: [], groups: [] },
    trigger: { type: 'record_created' },
    targets: [{ milestoneKey: 'resolution', priorityKey: '', durationMinutes: 8 * 60 }],
    pauseConditions: [],
    resumeConditions: [],
    successCriteria: { combinator: 'all', clauses: [], groups: [] },
    calendar: { mode: 'business' }
  };

  const action = await upsertMappedPolicy(organizationId, mapped);
  return { action, policyKey: DEFAULT_SLA_POLICY_KEY };
}

async function migrateHelpdeskPoliciesToGeneric(organizationId) {
  const settings = await loadHelpdeskExecutionSettings(organizationId);
  const results = { created: 0, updated: 0, skipped: 0, policies: [] };

  const defaultResult = await ensureDefaultSlaPolicy(organizationId);
  results.policies.push(DEFAULT_SLA_POLICY_KEY);
  if (defaultResult.action === 'created') results.created += 1;
  else results.updated += 1;

  for (const legacy of settings.slaPolicies) {
    if (!legacy?.key) {
      results.skipped += 1;
      continue;
    }

    const mapped = mapLegacyPolicy(legacy, {
      standardTargets: settings.slaPriorityTargets,
      defaultPolicyKey: settings.defaultSlaPolicyKey,
      businessHours: settings.businessHours
    });

    const action = await upsertMappedPolicy(organizationId, mapped);
    if (action === 'created') results.created += 1;
    else results.updated += 1;
    results.policies.push(mapped.policyKey);
  }

  return results;
}

async function setDefaultSlaPolicy(organizationId, policyKey, moduleKey = 'cases') {
  const key = String(policyKey || '').trim();
  if (!key) return null;

  await SlaPolicy.updateMany(
    {
      organizationId,
      'scope.moduleKey': String(moduleKey).toLowerCase(),
      deletedAt: null
    },
    { $set: { isDefault: false } }
  );

  const policy = await SlaPolicy.findOneAndUpdate(
    {
      organizationId,
      policyKey: key,
      'scope.moduleKey': String(moduleKey).toLowerCase(),
      deletedAt: null
    },
    { $set: { isDefault: true, active: true } },
    { new: true }
  );

  if (policy?.policyKey === DEFAULT_SLA_POLICY_KEY) {
    await TenantAppConfiguration.updateOne(
      { organizationId, appKey: 'HELPDESK' },
      { $set: { 'settings.helpdeskExecution.defaultSlaPolicyKey': null, 'settings.defaultSlaPolicyKey': null } }
    );
  } else if (policy) {
    await TenantAppConfiguration.updateOne(
      { organizationId, appKey: 'HELPDESK' },
      {
        $set: {
          'settings.helpdeskExecution.defaultSlaPolicyKey': policy.policyKey,
          'settings.defaultSlaPolicyKey': policy.policyKey
        }
      }
    );
  }

  return policy?.toObject?.() || policy;
}

module.exports = {
  DEFAULT_SLA_POLICY_KEY,
  migrateHelpdeskPoliciesToGeneric,
  ensureDefaultSlaPolicy,
  ensureDefaultSlaPolicyForModule,
  mapLegacyPolicy,
  mapDefaultSlaPolicy,
  syncDefaultPolicyToLegacySettings,
  setDefaultSlaPolicy,
  targetsToLegacyPriorityTargets
};
