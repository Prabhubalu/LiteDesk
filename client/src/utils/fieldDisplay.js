/**
 * Utility functions for displaying field values based on field definitions
 */

import {
  formatCurrencyValue,
  getCurrencySymbolFromCode,
  resolveCurrencyCodeForField,
} from './currencyOptions';
import { i18n } from '@/i18n';
import { resolveFieldLabel } from './fieldLabelResolver';
import { formatUserDate, formatUserDateTime, formatNumberWithDisplayPrefs } from '@/utils/localeFormat';

function normalizeAssignedToKey(key) {
  const fk = String(key || '').trim().toLowerCase().replace(/-/g, '_');
  return fk === 'assignedto' || fk === 'assigned_to';
}

const LEGACY_ASSIGNED_TO_LABELS = new Set([
  'owner',
  'deal owner',
  'event owner',
  'case owner',
  'case owner id',
  'assigned to (owner)',
]);

/**
 * Format a field key (camelCase or snake_case) to a human-readable label (Title Case with spaces).
 * @param {string} key - Field key, e.g. "assignedTo", "start_date"
 * @returns {string} Human-readable label, e.g. "Assigned To", "Start Date"
 */
export function formatKeyToLabel(key) {
  if (key == null || key === '') return '';
  return String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Get display label for a field from its configuration.
 * Uses field.label when present and not the same as the key (e.g. not raw camelCase);
 * otherwise formats field.key to a readable label. Use everywhere we show field labels.
 * @param {{ key?: string, label?: string, moduleKey?: string }|null} field - Field definition with key and optional label
 * @param {string} [moduleKey] - Optional module key for i18n catalog resolution
 * @returns {string} Human-readable label to show in UI
 */
export function getFieldDisplayLabel(field, moduleKey = null) {
  if (!field) return '';
  const mk = moduleKey || field.moduleKey || '';
  const t = i18n.global.t.bind(i18n.global);
  const te = i18n.global.te.bind(i18n.global);
  const key = String(field.key || '').trim();
  const label = String(field.label || '').trim();
  const keyCompact = key.replace(/[\s_-]+/g, '').toLowerCase();
  const hasGlobalSystemLabel =
    keyCompact === 'contactid' || keyCompact === 'organizationrefid';

  if (normalizeAssignedToKey(key) && LEGACY_ASSIGNED_TO_LABELS.has(label.toLowerCase())) {
    const resolved = resolveFieldLabel(mk, field, t, te);
    if (resolved) return resolved;
  }

  // Resolve system catalog even without moduleKey for shared technical lookup keys
  // (list headers / customize often call this without moduleKey).
  if (mk || normalizeAssignedToKey(key) || hasGlobalSystemLabel) {
    const resolved = resolveFieldLabel(mk, field, t, te);
    if (resolved && !isRawFieldKeyLabel(key, resolved)) return resolved;
  }

  if (!label || isRawFieldKeyLabel(key, label)) return formatKeyToLabel(key);
  return label;
}

/** True when label is the technical field key (camelCase/snake), not a human Field Label. */
function isRawFieldKeyLabel(key, label) {
  const keyStr = String(key || '').trim();
  const labelStr = String(label || '').trim();
  if (!keyStr || !labelStr) return !labelStr;
  if (labelStr === keyStr) return true;
  const keyNorm = keyStr.replace(/[\s_-]+/g, '').toLowerCase();
  const labelNorm = labelStr.replace(/[\s_-]+/g, '').toLowerCase();
  return Boolean(keyNorm && labelNorm === keyNorm && !/\s/.test(labelStr));
}

/**
 * Strip HTML tags and normalize whitespace to get plain text (e.g. for Rich Text in list/kanban).
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
export const getPlainTextFromHtml = (html) => {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

/**
 * Plain-text display for record detail panes — never show raw HTML tags in field rows.
 * @param {*} value
 * @param {{ key?: string, dataType?: string }|null} [field]
 * @returns {string}
 */
export function stripHtmlForDetailDisplay(value, field) {
  if (value == null || value === '') return '';
  const str = String(value);
  const dt = String(field?.dataType || '').toLowerCase();
  const key = String(field?.key || '').toLowerCase();
  const isRichField =
    dt.includes('rich') ||
    dt.includes('text-area') ||
    dt.includes('textarea') ||
    key === 'description' ||
    key === 'body' ||
    key === 'notes' ||
    key === 'resolutionsummary';
  if (isRichField || /<[^>]+>/.test(str)) {
    return getPlainTextFromHtml(str) || '';
  }
  return str;
}

/** ISO date/datetime regex - matches 2026-02-16 or 2026-02-16T18:30:00.000Z */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;

/** ObjectId regex - 24 hex characters (MongoDB ObjectId) - never show raw in UI */
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

/** Type labels for Task relatedTo polymorphic lookup */
const RELATED_TO_TYPE_LABELS = {
  contact: 'People',
  deal: 'Deal',
  organization: 'Organization',
  project: 'Project',
  none: 'None'
};

/**
 * Format Task "Related To" field value for display.
 * Handles { type, id } structure; id may be populated object or raw ObjectId.
 * @param {*} value - relatedTo value: { type, id } or null/undefined
 * @returns {string|null} Display string or null if empty
 */
export function formatRelatedToForDisplay(value) {
  if (!value || typeof value !== 'object') return null;
  const rt = value;
  if (rt.type === 'none' || !rt.id) return null;
  const typeLabel = RELATED_TO_TYPE_LABELS[rt.type] || rt.type;
  let nameVal = null;
  if (rt.id && typeof rt.id === 'object') {
    nameVal = rt.id.name || rt.id.title || rt.id.firstName || rt.id.first_name || rt.id.label || rt.id.email || rt.id.username;
    if (!nameVal && rt.id._id && isObjectIdLike(rt.id._id)) nameVal = null; // populated but no display - mask
  } else if (rt.name) {
    nameVal = rt.name;
  } else if (rt.id && !isObjectIdLike(rt.id)) {
    nameVal = String(rt.id);
  }
  if (!nameVal) return `${typeLabel}: —`; // raw ObjectId or no display - never show raw id
  return `${typeLabel}: ${nameVal}`;
}

/**
 * Check if a value looks like a raw ObjectId - should never be shown to users.
 * @param {*} value
 * @returns {boolean}
 */
export function isObjectIdLike(value) {
  if (value == null) return false;
  const str = String(value).trim();
  return str.length === 24 && OBJECT_ID_REGEX.test(str);
}

/**
 * Resolve picklist display label from options. Options can be strings or { value, label }.
 * @param {*} rawValue - Stored value
 * @param {Array} options - Field options
 * @returns {string} Display label or raw value if no match (prefer label over raw)
 */
function resolvePicklistLabel(rawValue, options) {
  if (!options || !Array.isArray(options)) return rawValue;
  const strVal = String(rawValue);
  for (const opt of options) {
    const optValue = opt && typeof opt === 'object' ? (opt.value ?? opt.label) : opt;
    if (String(optValue) === strVal) {
      const label = opt && typeof opt === 'object' ? (opt.label ?? opt.value) : opt;
      return label != null ? String(label) : strVal;
    }
  }
  return rawValue;
}

/**
 * Format a date-like value for user-friendly display.
 * Handles ISO strings, Date objects, and timestamps.
 * Uses the active user time zone + dateFormat from localeFormat context.
 * @param {string|Date|number} value - Raw value (ISO string, Date, or timestamp)
 * @param {'Date'|'Date-Time'|'DateTime'|'date'} [dataType] - Optional type hint
 * @returns {string|null} Formatted date string or null if invalid
 */
export function formatDateForDisplay(value, dataType) {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return null;
  let isDateTime = dataType === 'Date-Time' || dataType === 'DateTime';
  // Activity / raw ISO values often omit dataType; treat time-bearing ISO as Date-Time.
  if (!isDateTime && !dataType && typeof value === 'string' && /T\d{2}:\d{2}/.test(value.trim())) {
    isDateTime = true;
  }
  const formatted = isDateTime ? formatUserDateTime(d) : formatUserDate(d);
  return formatted || null;
}

/**
 * Format activity field-change from/to values (respects user date/time prefs).
 * @param {*} value
 * @param {string} [emptyLabel='Empty']
 * @param {string} [dataType]
 * @returns {string}
 */
export function formatActivityChangeValue(value, emptyLabel = 'Empty', dataType) {
  if (value === undefined || value === null || value === '') return emptyLabel;
  if (
    dataType === 'Date' ||
    dataType === 'Date-Time' ||
    dataType === 'DateTime' ||
    dataType === 'date'
  ) {
    return formatDateForDisplay(value, dataType) || emptyLabel;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateForDisplay(value, 'Date-Time') || emptyLabel;
  }
  if (typeof value === 'string' && isIsoDateString(value)) {
    return formatDateForDisplay(value) || value;
  }
  return String(value);
}

/**
 * Check if a value looks like an ISO date/datetime string.
 * @param {*} value
 * @returns {boolean}
 */
export function isIsoDateString(value) {
  if (typeof value !== 'string') return false;
  return ISO_DATE_REGEX.test(value.trim());
}

/**
 * Get key fields from a module definition
 * @param {Object} moduleDefinition - The module definition object
 * @returns {Array} Array of key field definitions
 */
export const getKeyFields = (moduleDefinition) => {
  if (!moduleDefinition?.fields) return [];
  
  return moduleDefinition.fields
    .filter(field => field.keyField === true)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
};

/**
 * Get formatted field value from a record based on field definition
 * @param {Object} fieldDef - The field definition
 * @param {Object} record - The record data
 * @returns {string|null} Formatted value or null if empty
 */
export const getFieldValue = (fieldDef, record) => {
  let value = record?.[fieldDef.key];
  if (value === null || value === undefined || value === '') {
    value = record?.customFields?.[fieldDef.key];
  }

  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // Task "Related To" polymorphic lookup - special structure { type, id }
  if (fieldDef.key === 'relatedTo' && typeof value === 'object' && value?.type) {
    return formatRelatedToForDisplay(value);
  }
  
  // Handle different data types
  const dt = fieldDef.dataType;
  switch (dt) {
    case 'Date':
    case 'date':
      return formatDateForDisplay(value, 'Date');
    case 'Date-Time':
    case 'DateTime':
      return formatDateForDisplay(value, 'Date-Time');
    case 'Currency':
      if (value === undefined) return null;
      const currencyCode = resolveCurrencyCodeForField({ record, fieldDef });
      const currencyOpts = { currencyCode };
      if (fieldDef.numberSettings?.decimalPlaces != null) {
        const decimalPlaces = Number(fieldDef.numberSettings.decimalPlaces);
        currencyOpts.minimumFractionDigits = decimalPlaces;
        currencyOpts.maximumFractionDigits = decimalPlaces;
      }
      return (
        formatCurrencyValue(value, currencyOpts) ||
        `${getCurrencySymbolFromCode(currencyCode)}${parseFloat(value).toFixed(2)}`
      );
    case 'Decimal': {
      const decimalOpts = {};
      if (fieldDef.numberSettings?.decimalPlaces != null) {
        const decimalPlaces2 = Number(fieldDef.numberSettings.decimalPlaces);
        decimalOpts.minimumFractionDigits = decimalPlaces2;
        decimalOpts.maximumFractionDigits = decimalPlaces2;
      }
      return value !== undefined
        ? formatNumberWithDisplayPrefs(Number(value), decimalOpts)
        : null;
    }
    case 'Integer':
      return value !== undefined
        ? formatNumberWithDisplayPrefs(Number.parseInt(value, 10), {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })
        : null;
    case 'Picklist':
      return resolvePicklistLabel(value, fieldDef.options);
    case 'Multi-Picklist':
      if (Array.isArray(value)) {
        return value.map((v) => resolvePicklistLabel(v, fieldDef.options)).join(', ');
      }
      return resolvePicklistLabel(value, fieldDef.options);
    case 'Checkbox':
      return value ? 'Yes' : 'No';
    case 'Lookup (Relationship)':
    case 'Lookup':
      // Handle lookup fields (populated objects)
      if (typeof value === 'object' && value !== null && value._id) {
        const display = value.name || value.title || value.firstName || value.first_name || value.label || value.email || value.username;
        if (display) return display;
        // Object with only _id - don't show raw ObjectId
        return '—';
      }
      // Unpopulated ObjectId string - never show raw
      if (isObjectIdLike(value)) return '—';
      return value;
    case 'Rich Text':
    case 'Text-Area':
      // Strip HTML for list/table display so we show plain text, not raw tags
      return getPlainTextFromHtml(value) || null;
    default:
      // Fallback: if value looks like ISO date string, format it for display
      if (isIsoDateString(value)) {
        return formatDateForDisplay(value);
      }
      // Never show raw ObjectIds
      if (isObjectIdLike(value)) return '—';
      // Objects without proper handling - extract display or mask
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const display = value.name || value.title || value.firstName || value.first_name || value.label || value.email || value.username;
        if (display) return display;
        return '—';
      }
      return value;
  }
};

/**
 * Format a raw value for display when field definition is minimal or absent.
 * Ensures we never show: raw ObjectIds, [object Object], JSON.stringify output.
 * @param {*} value - Raw value from record
 * @param {{ key?: string, dataType?: string, options?: Array }|null} [column] - Optional column/field info
 * @returns {string} Safe display string
 */
export function formatRawValueForDisplay(value, column) {
  if (value === null || value === undefined || value === '') return '';
  const dt = column?.dataType;

  // Task "Related To" polymorphic lookup - special structure { type, id }
  if (column?.key === 'relatedTo' && typeof value === 'object' && value?.type) {
    return formatRelatedToForDisplay(value) ?? '';
  }

  // Dates
  if (dt && (dt === 'Date' || dt === 'Date-Time' || dt === 'DateTime' || dt === 'date')) {
    const formatted = formatDateForDisplay(value, dt);
    return formatted ?? '';
  }
  if (typeof value === 'string' && isIsoDateString(value)) {
    const formatted = formatDateForDisplay(value);
    return formatted ?? value;
  }

  // Objects - extract display, never JSON.stringify
  if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
    const display = value.name || value.title || value.firstName || value.first_name || value.label || value.email || value.username;
    if (display) return String(display);
    if (value._id && isObjectIdLike(value._id)) return '—';
    return '—';
  }

  // Arrays (e.g. multi-picklist)
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    const parts = value.map((item) => {
      if (typeof item === 'object' && item !== null) {
        return item.name || item.title || item.label || item.firstName || item.first_name || '—';
      }
      if (isObjectIdLike(item)) return '—';
      return String(item);
    });
    return parts.join(', ');
  }

  // ObjectId strings - never show raw
  if (isObjectIdLike(value)) return '—';

  return String(value);
}

/**
 * Get all key field values for a record
 * @param {Object} moduleDefinition - The module definition object
 * @param {Object} record - The record data
 * @returns {Array} Array of { fieldDef, value, label } objects
 */
export const getKeyFieldValues = (moduleDefinition, record) => {
  const keyFields = getKeyFields(moduleDefinition);
  return keyFields.map(fieldDef => ({
    fieldDef,
    value: getFieldValue(fieldDef, record),
    label: getFieldDisplayLabel(fieldDef) || fieldDef.key
  }));
};

