/**
 * Event status lifecycle resolution and validation.
 */

const EventTypeStatusConfig = require('../models/EventTypeStatusConfig');
const Event = require('../models/Event');
const {
  STATUS_CATEGORIES,
  STATUS_CONFIGURABLE_TYPE_KEYS,
  SYSTEM_STATUS_VALUES,
  MEETING_SYSTEM_STATUS_VALUES,
  EVENT_TYPE_LABEL_BY_KEY,
  LEGACY_CATEGORY_BY_LABEL,
  normalizeEventTypeKey,
  isStatusConfigurableType,
  isAuditEventTypeKey,
  mergeStatusValues,
  getActiveValues,
  findValueByLabel,
  findDefaultForCategory,
  resolveStatusCategory,
  validateConfigurableValues,
  cloneSystemValues,
} = require('../domain/events/eventStatus');

/**
 * Resolved status config for one event type (system defaults + tenant overrides).
 */
async function getResolvedStatusConfig(organizationId, eventTypeOrKey) {
  const eventTypeKey = normalizeEventTypeKey(eventTypeOrKey) || 'MEETING';
  const configurable = isStatusConfigurableType(eventTypeKey);

  let custom = [];
  if (configurable && organizationId) {
    const doc = await EventTypeStatusConfig.findOne({
      organizationId,
      eventTypeKey,
    }).lean();
    if (doc?.values?.length) custom = doc.values;
  }

  const values = configurable
    ? mergeStatusValues(custom, eventTypeKey)
    : cloneSystemValues(eventTypeKey);
  return {
    eventTypeKey,
    label: EVENT_TYPE_LABEL_BY_KEY[eventTypeKey] || eventTypeKey,
    configurable,
    isAudit: isAuditEventTypeKey(eventTypeKey),
    categories: STATUS_CATEGORIES.slice(),
    values,
    activeValues: getActiveValues(values),
  };
}

/**
 * All type configs for settings UI.
 */
async function getAllResolvedStatusConfigs(organizationId) {
  const keys = Object.keys(EVENT_TYPE_LABEL_BY_KEY);
  const configs = await Promise.all(
    keys.map((k) => getResolvedStatusConfig(organizationId, k))
  );
  return configs;
}

/**
 * Union of active status labels (for module field options / list filters).
 */
async function getUnionStatusLabels(organizationId) {
  const configs = await getAllResolvedStatusConfigs(organizationId);
  const byLabel = new Map();
  for (const cfg of configs) {
    for (const v of cfg.activeValues) {
      if (!byLabel.has(v.label)) {
        byLabel.set(v.label, {
          value: v.label,
          label: v.label,
          color: v.color,
          category: v.category,
        });
      }
    }
  }
  // Prefer Meeting-facing labels first in union lists
  const preferredOrder = [
    ...MEETING_SYSTEM_STATUS_VALUES.filter((s) => !s.archived).map((s) => s.label),
    ...SYSTEM_STATUS_VALUES.map((s) => s.label),
  ];
  return Array.from(byLabel.values()).sort((a, b) => {
    const ai = preferredOrder.indexOf(a.value);
    const bi = preferredOrder.indexOf(b.value);
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
    return a.label.localeCompare(b.label);
  });
}

/**
 * Persist tenant vocabulary for a configurable type.
 */
async function updateStatusConfig(organizationId, eventTypeOrKey, values, userId) {
  const eventTypeKey = normalizeEventTypeKey(eventTypeOrKey);
  if (!eventTypeKey || !STATUS_CONFIGURABLE_TYPE_KEYS.includes(eventTypeKey)) {
    return {
      ok: false,
      message: 'Status vocabulary is only configurable for non-audit event types (Meeting, Field Sales Beat).',
    };
  }

  const validated = validateConfigurableValues(values, eventTypeKey);
  if (!validated.ok) return validated;

  // Block hard-delete of in-use custom labels: only allow archive if in use
  const previous = await getResolvedStatusConfig(organizationId, eventTypeKey);
  const prevActiveLabels = new Set(previous.activeValues.map((v) => v.label));
  const nextActiveLabels = new Set(
    validated.values.filter((v) => !v.archived).map((v) => v.label)
  );

  const removedLabels = [...prevActiveLabels].filter((l) => !nextActiveLabels.has(l));
  if (removedLabels.length) {
    const inUse = await Event.countDocuments({
      organizationId,
      eventType: EVENT_TYPE_LABEL_BY_KEY[eventTypeKey],
      status: { $in: removedLabels },
      deletedAt: null,
    });
    if (inUse > 0) {
      return {
        ok: false,
        message: `Cannot remove statuses in use (${removedLabels.join(', ')}). Archive them instead.`,
        inUseCount: inUse,
      };
    }
  }

  const doc = await EventTypeStatusConfig.findOneAndUpdate(
    { organizationId, eventTypeKey },
    {
      organizationId,
      eventTypeKey,
      values: validated.values,
      modifiedBy: userId || null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    ok: true,
    config: await getResolvedStatusConfig(organizationId, eventTypeKey),
    doc,
  };
}

/**
 * Validate status label for type; returns value def + category.
 */
async function resolveStatusValue(organizationId, eventTypeOrKey, statusLabel) {
  const eventTypeKey = normalizeEventTypeKey(eventTypeOrKey) || 'MEETING';
  // Meeting vocabulary never includes Planned — map to Scheduled
  let label = statusLabel;
  if (
    eventTypeKey === 'MEETING' &&
    label &&
    String(label).trim().toLowerCase() === 'planned'
  ) {
    label = 'Scheduled';
  }

  const config = await getResolvedStatusConfig(organizationId, eventTypeKey);
  const match = findValueByLabel(config.values, label);
  if (!match) {
    // Accept only non-Meeting legacy labels via LEGACY map (not preferred for Meeting)
    if (eventTypeKey !== 'MEETING') {
      const category = resolveStatusCategory(label, config.values);
      if (label && LEGACY_CATEGORY_BY_LABEL[String(label)]) {
        return {
          ok: true,
          value: {
            key: `legacy_${String(label).toLowerCase().replace(/\s+/g, '_')}`,
            label,
            category,
            isSystem: true,
            archived: false,
            isDefault: false,
          },
          category,
          config,
          legacy: true,
        };
      }
    }
    return {
      ok: false,
      message: `Invalid status "${statusLabel}" for ${config.label}.`,
      config,
    };
  }
  if (match.archived) {
    return {
      ok: false,
      message: `Status "${match.label}" is archived and cannot be selected.`,
      config,
    };
  }
  return {
    ok: true,
    value: match,
    category: match.category,
    config,
  };
}

/**
 * Default OPEN status for create.
 */
async function getDefaultOpenStatus(organizationId, eventTypeOrKey) {
  const config = await getResolvedStatusConfig(organizationId, eventTypeOrKey);
  const def = findDefaultForCategory(config.values, 'OPEN');
  return {
    label: def?.label || (normalizeEventTypeKey(eventTypeOrKey) === 'MEETING' ? 'Scheduled' : 'Planned'),
    category: 'OPEN',
    value: def,
    config,
  };
}

/**
 * Default status for complete / cancel actions.
 */
async function getDefaultTerminalStatus(organizationId, eventTypeOrKey, category) {
  const config = await getResolvedStatusConfig(organizationId, eventTypeOrKey);
  const def = findDefaultForCategory(config.values, category);
  return {
    label: def?.label || (category === 'DONE' ? 'Completed' : 'Cancelled'),
    category,
    value: def,
    config,
  };
}

/**
 * Apply status + category + terminal timestamps onto event document (mutates).
 */
function applyStatusTransition(event, { newStatus, category, userId, reason }) {
  const oldStatus = event.status;
  const oldCategory = event.statusCategory || resolveStatusCategory(oldStatus);

  event.status = newStatus;
  event.statusCategory = category;

  if (category === 'DONE') {
    event.completedAt = event.completedAt || new Date();
    if (!event.executionEndTime) event.executionEndTime = new Date();
  } else if (category === 'CANCELLED') {
    event.cancelledAt = event.cancelledAt || new Date();
    if (userId) event.cancelledBy = userId;
    if (reason) event.cancellationReason = String(reason).substring(0, 500);
  } else if (category === 'OPEN') {
    // Reopen clears terminal stamps
    event.completedAt = null;
    event.cancelledAt = null;
    event.cancelledBy = null;
    event.cancellationReason = null;
  }

  if (typeof event.addAuditEntry === 'function' && oldStatus !== newStatus) {
    event.addAuditEntry('status_changed', userId, oldStatus, newStatus, {
      reason: reason || 'Status updated',
      fromCategory: oldCategory,
      toCategory: category,
    });
  }

  return { oldStatus, oldCategory, newStatus, category };
}

/**
 * Whether status may be set by client update (non-audit only).
 */
function allowsManualStatusChange(eventTypeOrKey) {
  return isStatusConfigurableType(eventTypeOrKey);
}

module.exports = {
  getResolvedStatusConfig,
  getAllResolvedStatusConfigs,
  getUnionStatusLabels,
  updateStatusConfig,
  resolveStatusValue,
  getDefaultOpenStatus,
  getDefaultTerminalStatus,
  applyStatusTransition,
  allowsManualStatusChange,
  resolveStatusCategory,
};
