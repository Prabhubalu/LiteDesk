/**
 * Event Status Lifecycle Domain
 *
 * World-class model:
 * - statusCategory (OPEN | DONE | CANCELLED) = system-owned semantics
 * - status (label) = vocabulary values, admin-configurable per non-audit type
 *
 * Meeting seeds: Scheduled, Completed, Cancelled, No Show
 * Other / audit seeds: Planned, Completed, Cancelled
 *
 * See: docs/architecture/event-status-lifecycle.md
 */

const STATUS_CATEGORIES = Object.freeze(['OPEN', 'DONE', 'CANCELLED']);

/** Event type keys that allow tenant status vocabulary management */
const STATUS_CONFIGURABLE_TYPE_KEYS = Object.freeze(['MEETING', 'FIELD_SALES_BEAT']);

const EVENT_TYPE_KEY_BY_LABEL = Object.freeze({
  Meeting: 'MEETING',
  'Meeting / Appointment': 'MEETING',
  'Internal Audit': 'INTERNAL_AUDIT',
  'External Audit — Single Org': 'EXTERNAL_AUDIT_SINGLE',
  'External Audit Beat': 'EXTERNAL_AUDIT_BEAT',
  'Field Sales Beat': 'FIELD_SALES_BEAT',
});

const EVENT_TYPE_LABEL_BY_KEY = Object.freeze({
  MEETING: 'Meeting',
  INTERNAL_AUDIT: 'Internal Audit',
  EXTERNAL_AUDIT_SINGLE: 'External Audit — Single Org',
  EXTERNAL_AUDIT_BEAT: 'External Audit Beat',
  FIELD_SALES_BEAT: 'Field Sales Beat',
});

/** Generic / audit / Field Sales Beat anchors */
const SYSTEM_STATUS_VALUES = Object.freeze([
  {
    key: 'planned',
    label: 'Planned',
    category: 'OPEN',
    color: '#3B82F6',
    order: 0,
    isDefault: true,
    isSystem: true,
    archived: false,
  },
  {
    key: 'completed',
    label: 'Completed',
    category: 'DONE',
    color: '#8B5CF6',
    order: 100,
    isDefault: true,
    isSystem: true,
    archived: false,
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    category: 'CANCELLED',
    color: '#6B7280',
    order: 200,
    isDefault: true,
    isSystem: true,
    archived: false,
  },
]);

/**
 * Meeting-native vocabulary (world-class CRM meeting seeds).
 * "Planned" is NOT a Meeting value — use Scheduled. Legacy Planned still maps OPEN via LEGACY_CATEGORY_BY_LABEL.
 */
const MEETING_SYSTEM_STATUS_VALUES = Object.freeze([
  {
    key: 'scheduled',
    label: 'Scheduled',
    category: 'OPEN',
    color: '#3B82F6',
    order: 0,
    isDefault: true,
    isSystem: true,
    archived: false,
  },
  {
    key: 'completed',
    label: 'Completed',
    category: 'DONE',
    color: '#16A34A',
    order: 100,
    isDefault: true,
    isSystem: true,
    archived: false,
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    category: 'CANCELLED',
    color: '#6B7280',
    order: 200,
    isDefault: true,
    isSystem: true,
    archived: false,
  },
  {
    key: 'no_show',
    label: 'No Show',
    category: 'CANCELLED',
    color: '#DC2626',
    order: 210,
    isDefault: false,
    isSystem: true,
    archived: false,
  },
]);

/** Legacy / system label → category (always honored when vocab not loaded) */
const LEGACY_CATEGORY_BY_LABEL = Object.freeze({
  Planned: 'OPEN',
  Scheduled: 'OPEN',
  SCHEDULED: 'OPEN',
  Rescheduled: 'OPEN',
  Completed: 'DONE',
  Cancelled: 'CANCELLED',
  'No Show': 'CANCELLED',
  'No-show': 'CANCELLED',
  NoShow: 'CANCELLED',
});

function normalizeEventTypeKey(eventTypeOrKey) {
  if (!eventTypeOrKey || typeof eventTypeOrKey !== 'string') return null;
  const raw = eventTypeOrKey.trim();
  if (!raw) return null;
  const upper = raw.toUpperCase().replace(/\s+/g, '_');
  if (EVENT_TYPE_LABEL_BY_KEY[upper]) return upper;
  if (EVENT_TYPE_KEY_BY_LABEL[raw]) return EVENT_TYPE_KEY_BY_LABEL[raw];
  const found = Object.entries(EVENT_TYPE_KEY_BY_LABEL).find(
    ([label]) => label.toLowerCase() === raw.toLowerCase()
  );
  return found ? found[1] : null;
}

function isStatusConfigurableType(eventTypeOrKey) {
  const key = normalizeEventTypeKey(eventTypeOrKey);
  return key ? STATUS_CONFIGURABLE_TYPE_KEYS.includes(key) : false;
}

function isAuditEventTypeKey(eventTypeOrKey) {
  const key = normalizeEventTypeKey(eventTypeOrKey);
  return Boolean(key && key.includes('AUDIT'));
}

/**
 * System seed values for a type (cloned).
 * @param {string|null} [eventTypeOrKey]
 */
function getSystemStatusValuesForType(eventTypeOrKey) {
  const key = normalizeEventTypeKey(eventTypeOrKey);
  if (key === 'MEETING') {
    return MEETING_SYSTEM_STATUS_VALUES.map((v) => ({ ...v }));
  }
  return SYSTEM_STATUS_VALUES.map((v) => ({ ...v }));
}

function cloneSystemValues(eventTypeOrKey = null) {
  return getSystemStatusValuesForType(eventTypeOrKey);
}

/**
 * @param {Array} customValues
 * @param {string|null} [eventTypeOrKey]
 */
function mergeStatusValues(customValues = [], eventTypeOrKey = null) {
  const byKey = new Map();
  for (const sys of getSystemStatusValuesForType(eventTypeOrKey)) {
    byKey.set(sys.key, { ...sys });
  }
  for (const raw of customValues || []) {
    if (!raw || typeof raw !== 'object') continue;
    const key =
      String(raw.key || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') || null;
    if (!key) continue;
    if (!STATUS_CATEGORIES.includes(raw.category)) continue;
    const label = String(raw.label || '').trim();
    if (!label) continue;

    const existing = byKey.get(key);
    if (existing?.isSystem) {
      // System keys: allow color/order/label tweaks; never change category.
      // isDefault / archived: tenant may set default among non-archived only for non-required defaults.
      let nextDefault = existing.isDefault;
      // Allow switching default among OPEN/DONE/CANCELLED system anchors
      if (raw.isDefault === true) nextDefault = true;
      if (raw.isDefault === false && !existing.isSystem) nextDefault = false;
      // For system keys that are default anchors, still allow isDefault true promotion
      if (raw.isDefault === true) nextDefault = true;

      byKey.set(key, {
        ...existing,
        label: label || existing.label,
        color: raw.color || existing.color,
        order: Number.isFinite(raw.order) ? raw.order : existing.order,
        archived:
          existing.key === 'planned' && existing.archived
            ? true // keep planned archived on Meeting
            : raw.archived === true
              ? true
              : existing.archived && raw.archived !== false
                ? existing.archived
                : Boolean(raw.archived),
        isDefault: nextDefault,
        isSystem: true,
        category: existing.category,
      });
      continue;
    }

    byKey.set(key, {
      key,
      label,
      category: raw.category,
      color: raw.color || '#6366F1',
      order: Number.isFinite(raw.order) ? raw.order : 50,
      isDefault: Boolean(raw.isDefault),
      isSystem: false,
      archived: Boolean(raw.archived),
    });
  }

  const values = Array.from(byKey.values()).sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.label.localeCompare(b.label);
  });

  // Exactly one default per category among active values
  for (const cat of STATUS_CATEGORIES) {
    const active = values.filter((v) => v.category === cat && !v.archived);
    if (active.length === 0) continue;
    const defaults = active.filter((v) => v.isDefault);
    if (defaults.length === 0) {
      active[0].isDefault = true;
    } else if (defaults.length > 1) {
      // Prefer system default anchor if multiple
      const systemDefault = defaults.find((v) => v.isSystem);
      const keepKey = (systemDefault || defaults[0]).key;
      defaults.forEach((v) => {
        v.isDefault = v.key === keepKey;
      });
    }
  }

  return values;
}

function getActiveValues(values) {
  return (values || []).filter((v) => !v.archived);
}

function findValueByLabel(values, label) {
  if (!label) return null;
  const needle = String(label).trim().toLowerCase();
  return (values || []).find((v) => String(v.label).trim().toLowerCase() === needle) || null;
}

function findDefaultForCategory(values, category) {
  const active = getActiveValues(values).filter((v) => v.category === category);
  return active.find((v) => v.isDefault) || active[0] || null;
}

/**
 * @param {string} statusLabel
 * @param {Array} [values]
 * @returns {'OPEN'|'DONE'|'CANCELLED'}
 */
function resolveStatusCategory(statusLabel, values = null) {
  if (values) {
    const match = findValueByLabel(values, statusLabel);
    if (match?.category && STATUS_CATEGORIES.includes(match.category)) {
      return match.category;
    }
  }
  if (statusLabel && LEGACY_CATEGORY_BY_LABEL[statusLabel]) {
    return LEGACY_CATEGORY_BY_LABEL[statusLabel];
  }
  if (statusLabel) {
    const found = Object.entries(LEGACY_CATEGORY_BY_LABEL).find(
      ([k]) => k.toLowerCase() === String(statusLabel).toLowerCase()
    );
    if (found) return found[1];
  }
  return 'OPEN';
}

function isTerminalCategory(category) {
  return category === 'DONE' || category === 'CANCELLED';
}

function isOpenStatus(statusLabel, values = null) {
  return resolveStatusCategory(statusLabel, values) === 'OPEN';
}

function isDoneStatus(statusLabel, values = null) {
  return resolveStatusCategory(statusLabel, values) === 'DONE';
}

function isCancelledStatus(statusLabel, values = null) {
  return resolveStatusCategory(statusLabel, values) === 'CANCELLED';
}

/**
 * Whether an event document is in OPEN lifecycle (can reschedule / remind / execute start).
 * Prefers denormalized statusCategory; falls back to label mapping.
 * @param {{ status?: string, statusCategory?: string }|null} event
 */
function isEventInOpenLifecycle(event) {
  if (!event) return false;
  if (event.statusCategory === 'OPEN') return true;
  if (event.statusCategory === 'DONE' || event.statusCategory === 'CANCELLED') return false;
  return resolveStatusCategory(event.status) === 'OPEN';
}

/**
 * @param {Array} inputValues
 * @param {string|null} [eventTypeOrKey]
 * @returns {{ ok: true, values: Array } | { ok: false, message: string }}
 */
function validateConfigurableValues(inputValues, eventTypeOrKey = null) {
  if (!Array.isArray(inputValues)) {
    return { ok: false, message: 'values must be an array' };
  }

  const typeKey = normalizeEventTypeKey(eventTypeOrKey);
  const systemSeeds = getSystemStatusValuesForType(typeKey);
  const merged = mergeStatusValues(inputValues, typeKey);
  const active = getActiveValues(merged);

  for (const cat of STATUS_CATEGORIES) {
    if (!active.some((v) => v.category === cat)) {
      return {
        ok: false,
        message: `At least one active status is required for category ${cat}`,
      };
    }
  }

  const labels = new Set();
  for (const v of active) {
    const l = v.label.toLowerCase();
    if (labels.has(l)) {
      return { ok: false, message: `Duplicate status label: ${v.label}` };
    }
    labels.add(l);
  }

  // Required system keys (non-archived system seeds must remain present)
  for (const sys of systemSeeds) {
    if (sys.archived) continue; // legacy optional keys (e.g. planned on Meeting)
    if (!merged.find((v) => v.key === sys.key)) {
      return { ok: false, message: `System status "${sys.label}" cannot be removed` };
    }
  }

  return { ok: true, values: merged };
}

module.exports = {
  STATUS_CATEGORIES,
  STATUS_CONFIGURABLE_TYPE_KEYS,
  SYSTEM_STATUS_VALUES,
  MEETING_SYSTEM_STATUS_VALUES,
  EVENT_TYPE_KEY_BY_LABEL,
  EVENT_TYPE_LABEL_BY_KEY,
  LEGACY_CATEGORY_BY_LABEL,
  normalizeEventTypeKey,
  isStatusConfigurableType,
  isAuditEventTypeKey,
  getSystemStatusValuesForType,
  cloneSystemValues,
  mergeStatusValues,
  getActiveValues,
  findValueByLabel,
  findDefaultForCategory,
  resolveStatusCategory,
  isTerminalCategory,
  isOpenStatus,
  isDoneStatus,
  isCancelledStatus,
  isEventInOpenLifecycle,
  validateConfigurableValues,
};
