const TenantAppConfiguration = require('../models/TenantAppConfiguration');
const { CASE_TYPES, CASE_PRIORITIES, CASE_CHANNELS } = require('../constants/caseLifecycle');
const {
  normalizeCannedResponses,
  sanitizeCannedResponsesForSave,
  validateCannedResponses
} = require('../services/caseCannedResponseService');

const ALLOWED_PRIORITIES = new Set(CASE_PRIORITIES);
const ALLOWED_CASE_TYPES = new Set(CASE_TYPES);
const ALLOWED_CHANNELS = new Set(CASE_CHANNELS);
const ALLOWED_ESCALATION_ACTIONS = new Set(['NOTIFY_OWNER', 'REASSIGN_OWNER', 'NOTIFY_LEADERSHIP']);

const DEFAULT_HELPDESK_EXECUTION_SETTINGS = {
  caseTypes: {
    enabled: [...CASE_TYPES]
  },
  slaPriorityTargets: {
    Low: { firstResponseMinutes: 480, resolutionMinutes: 4320 },
    Medium: { firstResponseMinutes: 240, resolutionMinutes: 2880 },
    High: { firstResponseMinutes: 120, resolutionMinutes: 1440 },
    Critical: { firstResponseMinutes: 60, resolutionMinutes: 480 }
  },
  businessHours: {
    enabled: false,
    scheduleSource: null,
    businessHourSetId: null,
    timezone: 'UTC',
    workingDays: [1, 2, 3, 4, 5],
    startTime: '09:00',
    endTime: '18:00'
  },
  slaPolicies: [],
  defaultSlaPolicyKey: null,
  escalationRules: [],
  channelRules: {},
  notifications: {
    notifyOnCreated: true,
    notifyOnAssigned: true,
    notifyOnSlaWarning: true,
    notifyOnSlaBreach: true
  },
  cannedResponses: []
};

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function cloneDefaultSettings() {
  return JSON.parse(JSON.stringify(DEFAULT_HELPDESK_EXECUTION_SETTINGS));
}

function isValidTimeHHMM(value) {
  if (typeof value !== 'string') return false;
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return Boolean(match);
}

function parseTimeMinutes(value) {
  const [h, m] = String(value).split(':').map(Number);
  return (h * 60) + m;
}

function normalizePriorityTargets(targets) {
  const output = {};
  for (const priority of CASE_PRIORITIES) {
    const source = isPlainObject(targets?.[priority]) ? targets[priority] : null;
    const firstResponseMinutes = Number(source?.firstResponseMinutes);
    const resolutionMinutes = Number(source?.resolutionMinutes);
    output[priority] = {
      firstResponseMinutes: Number.isFinite(firstResponseMinutes) && firstResponseMinutes > 0
        ? Math.floor(firstResponseMinutes)
        : DEFAULT_HELPDESK_EXECUTION_SETTINGS.slaPriorityTargets[priority].firstResponseMinutes,
      resolutionMinutes: Number.isFinite(resolutionMinutes) && resolutionMinutes > 0
        ? Math.floor(resolutionMinutes)
        : DEFAULT_HELPDESK_EXECUTION_SETTINGS.slaPriorityTargets[priority].resolutionMinutes
    };
  }
  return output;
}

function mergeWithDefaults(rawSettings) {
  const merged = cloneDefaultSettings();
  const source = isPlainObject(rawSettings) ? rawSettings : {};

  if (isPlainObject(source.caseTypes) && Array.isArray(source.caseTypes.enabled)) {
    merged.caseTypes.enabled = source.caseTypes.enabled.filter((value) => ALLOWED_CASE_TYPES.has(value));
    if (merged.caseTypes.enabled.length === 0) merged.caseTypes.enabled = [...CASE_TYPES];
  }

  merged.slaPriorityTargets = normalizePriorityTargets(source.slaPriorityTargets);

  if (isPlainObject(source.businessHours)) {
    const businessHours = source.businessHours;
    if (typeof businessHours.enabled === 'boolean') merged.businessHours.enabled = businessHours.enabled;
    if (['inherit', 'custom', 'legacy'].includes(businessHours.scheduleSource)) {
      merged.businessHours.scheduleSource = businessHours.scheduleSource;
    } else if (businessHours.scheduleSource === null) {
      merged.businessHours.scheduleSource = null;
    }
    if (businessHours.businessHourSetId) {
      merged.businessHours.businessHourSetId = String(businessHours.businessHourSetId);
    } else if (businessHours.businessHourSetId === null) {
      merged.businessHours.businessHourSetId = null;
    }
    if (typeof businessHours.timezone === 'string' && businessHours.timezone.trim()) {
      merged.businessHours.timezone = businessHours.timezone.trim();
    }
    if (Array.isArray(businessHours.workingDays)) {
      merged.businessHours.workingDays = [...new Set(
        businessHours.workingDays
          .map((day) => Number(day))
          .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      )];
      if (merged.businessHours.workingDays.length === 0) {
        merged.businessHours.workingDays = [...DEFAULT_HELPDESK_EXECUTION_SETTINGS.businessHours.workingDays];
      }
    }
    if (isValidTimeHHMM(businessHours.startTime)) merged.businessHours.startTime = businessHours.startTime;
    if (isValidTimeHHMM(businessHours.endTime)) merged.businessHours.endTime = businessHours.endTime;
  }

  if (Array.isArray(source.slaPolicies)) merged.slaPolicies = source.slaPolicies;
  if (typeof source.defaultSlaPolicyKey === 'string' || source.defaultSlaPolicyKey === null) {
    merged.defaultSlaPolicyKey = source.defaultSlaPolicyKey;
  }
  if (Array.isArray(source.escalationRules)) merged.escalationRules = source.escalationRules;
  if (isPlainObject(source.channelRules)) merged.channelRules = source.channelRules;
  if (isPlainObject(source.notifications)) {
    merged.notifications = {
      ...merged.notifications,
      ...source.notifications
    };
  }

  merged.cannedResponses = normalizeCannedResponses(source.cannedResponses);

  return merged;
}

function validatePriorityTargets(targets) {
  if (!isPlainObject(targets)) return 'slaPriorityTargets must be an object';
  for (const priority of CASE_PRIORITIES) {
    const entry = targets[priority];
    if (!isPlainObject(entry)) return `slaPriorityTargets.${priority} must be an object`;
    const firstResponseMinutes = Number(entry.firstResponseMinutes);
    const resolutionMinutes = Number(entry.resolutionMinutes);
    if (!Number.isFinite(firstResponseMinutes) || firstResponseMinutes <= 0) {
      return `slaPriorityTargets.${priority}.firstResponseMinutes must be a positive number`;
    }
    if (!Number.isFinite(resolutionMinutes) || resolutionMinutes <= 0) {
      return `slaPriorityTargets.${priority}.resolutionMinutes must be a positive number`;
    }
  }
  return null;
}

function validateBusinessHours(businessHours) {
  if (!isPlainObject(businessHours)) return 'businessHours must be an object';
  if (typeof businessHours.enabled !== 'boolean') return 'businessHours.enabled must be a boolean';

  if (!businessHours.enabled) return null;

  const source = businessHours.scheduleSource || 'legacy';

  if (source === 'custom') {
    if (!businessHours.businessHourSetId || typeof businessHours.businessHourSetId !== 'string') {
      return 'businessHours.businessHourSetId is required when scheduleSource is custom';
    }
    return null;
  }

  if (source === 'inherit') return null;

  if (typeof businessHours.timezone !== 'string' || !businessHours.timezone.trim()) {
    return 'businessHours.timezone is required for inline SLA hours';
  }
  if (!Array.isArray(businessHours.workingDays) || businessHours.workingDays.length === 0) {
    return 'businessHours.workingDays must be a non-empty array';
  }
  for (const day of businessHours.workingDays) {
    if (!Number.isInteger(day) || day < 0 || day > 6) return 'businessHours.workingDays values must be integers 0-6';
  }
  if (!isValidTimeHHMM(businessHours.startTime) || !isValidTimeHHMM(businessHours.endTime)) {
    return 'businessHours.startTime and businessHours.endTime must be HH:MM';
  }
  if (parseTimeMinutes(businessHours.endTime) <= parseTimeMinutes(businessHours.startTime)) {
    return 'businessHours.endTime must be later than startTime';
  }
  return null;
}

function validateSlaPolicies(settings) {
  if (!Array.isArray(settings.slaPolicies)) return 'slaPolicies must be an array';
  const keys = new Set();
  for (const policy of settings.slaPolicies) {
    if (!isPlainObject(policy)) return 'Each slaPolicy must be an object';
    if (typeof policy.key !== 'string' || !policy.key.trim()) return 'Each slaPolicy requires a non-empty key';
    if (keys.has(policy.key)) return `Duplicate slaPolicy key: ${policy.key}`;
    keys.add(policy.key);
    if (typeof policy.name !== 'string' || !policy.name.trim()) return `slaPolicy ${policy.key} requires a name`;
    if (policy.priorities && (!Array.isArray(policy.priorities) || policy.priorities.some((p) => !ALLOWED_PRIORITIES.has(p)))) {
      return `slaPolicy ${policy.key} has invalid priorities`;
    }
    if (policy.caseTypes && (!Array.isArray(policy.caseTypes) || policy.caseTypes.some((t) => !ALLOWED_CASE_TYPES.has(t)))) {
      return `slaPolicy ${policy.key} has invalid caseTypes`;
    }
    if (policy.channels && (!Array.isArray(policy.channels) || policy.channels.some((c) => !ALLOWED_CHANNELS.has(c)))) {
      return `slaPolicy ${policy.key} has invalid channels`;
    }
    if (policy.priorityTargets) {
      const err = validatePriorityTargets(policy.priorityTargets);
      if (err) return `slaPolicy ${policy.key}: ${err}`;
    }
  }
  if (settings.defaultSlaPolicyKey && !keys.has(settings.defaultSlaPolicyKey)) {
    return 'defaultSlaPolicyKey must match one of slaPolicies[].key';
  }
  return null;
}

function validateEscalationRules(rules) {
  if (!Array.isArray(rules)) return 'escalationRules must be an array';
  for (const rule of rules) {
    if (!isPlainObject(rule)) return 'Each escalationRule must be an object';
    if (typeof rule.key !== 'string' || !rule.key.trim()) return 'Each escalationRule requires key';
    if (typeof rule.name !== 'string' || !rule.name.trim()) return 'Each escalationRule requires name';
    if (!Number.isFinite(Number(rule.triggerPercent)) || Number(rule.triggerPercent) <= 0 || Number(rule.triggerPercent) > 100) {
      return `escalationRule ${rule.key} triggerPercent must be between 1 and 100`;
    }
    if (!ALLOWED_ESCALATION_ACTIONS.has(rule.actionType)) {
      return `escalationRule ${rule.key} actionType is invalid`;
    }
  }
  return null;
}

function validateChannelRules(channelRules) {
  if (!isPlainObject(channelRules)) return 'channelRules must be an object';
  for (const [channel, rule] of Object.entries(channelRules)) {
    if (!ALLOWED_CHANNELS.has(channel)) return `channelRules contains invalid channel: ${channel}`;
    if (!isPlainObject(rule)) return `channelRules.${channel} must be an object`;
    if (rule.defaultCaseType && !ALLOWED_CASE_TYPES.has(rule.defaultCaseType)) {
      return `channelRules.${channel}.defaultCaseType is invalid`;
    }
    if (rule.defaultPriority && !ALLOWED_PRIORITIES.has(rule.defaultPriority)) {
      return `channelRules.${channel}.defaultPriority is invalid`;
    }
  }
  return null;
}

function validateNotifications(notifications) {
  if (!isPlainObject(notifications)) return 'notifications must be an object';
  const allowedKeys = ['notifyOnCreated', 'notifyOnAssigned', 'notifyOnSlaWarning', 'notifyOnSlaBreach'];
  for (const key of allowedKeys) {
    if (key in notifications && typeof notifications[key] !== 'boolean') {
      return `notifications.${key} must be a boolean`;
    }
  }
  return null;
}

function validateExecutionSettings(settings) {
  if (!isPlainObject(settings)) return 'Payload must be an object';

  if (!isPlainObject(settings.caseTypes) || !Array.isArray(settings.caseTypes.enabled)) {
    return 'caseTypes.enabled must be an array';
  }
  if (settings.caseTypes.enabled.some((value) => !ALLOWED_CASE_TYPES.has(value))) {
    return 'caseTypes.enabled contains invalid case type';
  }
  if (settings.caseTypes.enabled.length === 0) {
    return 'At least one case type must remain enabled';
  }

  const priorityErr = validatePriorityTargets(settings.slaPriorityTargets);
  if (priorityErr) return priorityErr;

  const bhErr = validateBusinessHours(settings.businessHours);
  if (bhErr) return bhErr;

  const policyErr = validateSlaPolicies(settings);
  if (policyErr) return policyErr;

  const escErr = validateEscalationRules(settings.escalationRules);
  if (escErr) return escErr;

  const chErr = validateChannelRules(settings.channelRules);
  if (chErr) return chErr;

  const notifErr = validateNotifications(settings.notifications);
  if (notifErr) return notifErr;

  const cannedErr = validateCannedResponses(settings.cannedResponses);
  if (cannedErr) return cannedErr;

  return null;
}

exports.getHelpdeskExecutionSettings = async (req, res) => {
  try {
    const config = await TenantAppConfiguration.findOne({
      organizationId: req.user.organizationId,
      appKey: 'HELPDESK'
    })
      .select('enabled settings')
      .lean();

    const saved = config?.settings?.helpdeskExecution;
    const effective = mergeWithDefaults(saved);

    return res.json({
      success: true,
      appKey: 'HELPDESK',
      enabled: config ? Boolean(config.enabled) : false,
      settings: effective
    });
  } catch (error) {
    console.error('[helpdeskSettingsController] getHelpdeskExecutionSettings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch Helpdesk execution settings'
    });
  }
};

exports.recalculateOpenCaseSlas = async (req, res) => {
  try {
    if (!req.user.isOwner && req.user.role !== 'admin' && !req.user.isPlatformAdmin) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { recalculateOpenCaseSlas } = require('../services/helpdeskSlaRecalculateService');
    const limit = Number(req.body?.limit) || 500;
    const result = await recalculateOpenCaseSlas(req.user.organizationId, { limit });

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[helpdeskSettingsController] recalculateOpenCaseSlas error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to recalculate open case SLAs'
    });
  }
};

exports.updateHelpdeskExecutionSettings = async (req, res) => {
  try {
    const rawBody = req.body?.settings || req.body || {};
    const cannedFromRequest = Array.isArray(rawBody.cannedResponses)
      ? sanitizeCannedResponsesForSave(rawBody.cannedResponses)
      : null;

    const incoming = mergeWithDefaults(rawBody);
    if (cannedFromRequest != null) {
      incoming.cannedResponses = cannedFromRequest;
    }

    const validationError = validateExecutionSettings(incoming);
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const helpdeskExecution = { ...incoming };
    const flatMirrors = {
      slaPriorityTargets: incoming.slaPriorityTargets,
      businessHours: incoming.businessHours,
      slaPolicies: incoming.slaPolicies,
      defaultSlaPolicyKey: incoming.defaultSlaPolicyKey,
      channelRules: incoming.channelRules,
      notifications: incoming.notifications,
      caseTypes: incoming.caseTypes,
      escalationRules: incoming.escalationRules
    };

    const doc = await TenantAppConfiguration.findOneAndUpdate(
      {
        organizationId: req.user.organizationId,
        appKey: 'HELPDESK'
      },
      {
        $set: {
          enabled: true,
          'settings.helpdeskExecution': helpdeskExecution,
          'settings.slaPriorityTargets': flatMirrors.slaPriorityTargets,
          'settings.businessHours': flatMirrors.businessHours,
          'settings.slaPolicies': flatMirrors.slaPolicies,
          'settings.defaultSlaPolicyKey': flatMirrors.defaultSlaPolicyKey,
          'settings.channelRules': flatMirrors.channelRules
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    ).lean();

    const persisted = doc?.settings?.helpdeskExecution || helpdeskExecution;
    return res.json({
      success: true,
      appKey: 'HELPDESK',
      enabled: Boolean(doc?.enabled),
      settings: mergeWithDefaults(persisted)
    });
  } catch (error) {
    console.error('[helpdeskSettingsController] updateHelpdeskExecutionSettings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update Helpdesk execution settings'
    });
  }
};
