/**
 * Canonical People module field defaults for SALES participation status picklists.
 * Stored in participations.SALES at runtime; exposed as normal module fields for Settings.
 */

const {
  buildDefaultColoredPicklistOptions,
  applyDefaultColorsToPicklistOptions,
} = require('./peopleParticipationPicklistColors');

function fieldKeyCanonical(k) {
  return String(k || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/-/g, '');
}

/** Map legacy context: 'app' + appKey to route token (e.g. sales, helpdesk). */
function normalizeParticipationFieldContext(field) {
  if (!field || typeof field !== 'object') return field;
  const ctx = String(field.context || '').trim().toLowerCase();
  if (ctx !== 'app') return field;
  const appKey = field.appKey != null ? String(field.appKey).trim().toLowerCase() : '';
  if (!appKey) return field;
  return { ...field, context: appKey };
}

function dedupeFieldsByKey(fields) {
  if (!Array.isArray(fields)) return fields;
  const byCanonical = new Map();
  for (const f of fields) {
    const k = fieldKeyCanonical(f?.key);
    if (!k) continue;
    const existing = byCanonical.get(k);
    if (!existing || ((f.key || '').indexOf(' ') === -1 && (existing.key || '').indexOf(' ') !== -1)) {
      byCanonical.set(k, f);
    }
  }
  return Array.from(byCanonical.values());
}

const DEFAULT_LEAD_STATUS_VALUES = Object.freeze([
  'New',
  'Contacted',
  'Qualified',
  'Disqualified',
  'Nurturing',
  'Re-Engage',
]);

const DEFAULT_CONTACT_STATUS_VALUES = Object.freeze([
  'Active',
  'Inactive',
  'DoNotContact',
]);

const DEFAULT_LEAD_STATUS_OPTIONS = Object.freeze(
  buildDefaultColoredPicklistOptions('lead_status', DEFAULT_LEAD_STATUS_VALUES)
);

const DEFAULT_CONTACT_STATUS_OPTIONS = Object.freeze(
  buildDefaultColoredPicklistOptions('contact_status', DEFAULT_CONTACT_STATUS_VALUES)
);

function leadStatusVisibilityDependency() {
  return {
    type: 'visibility',
    logic: 'AND',
    conditions: [{ fieldKey: 'sales_type', operator: 'equals', value: 'Lead' }],
  };
}

function contactStatusVisibilityDependency() {
  return {
    type: 'visibility',
    logic: 'AND',
    conditions: [{ fieldKey: 'sales_type', operator: 'equals', value: 'Contact' }],
  };
}

function getLeadStatusModuleField(overrides = {}) {
  return {
    key: 'lead_status',
    label: 'Lead Status',
    dataType: 'Picklist',
    keyField: false,
    required: false,
    options: [...DEFAULT_LEAD_STATUS_OPTIONS.map((opt) => ({ ...opt }))],
    defaultValue: null,
    visibility: { list: true, detail: true },
    owner: 'platform',
    context: 'sales',
    appKey: 'SALES',
    filterable: false,
    filterType: null,
    filterPriority: null,
    dependencies: [leadStatusVisibilityDependency()],
    validations: [],
    lookupSettings: null,
    index: false,
    placeholder: '',
    order: 0,
    ...overrides,
  };
}

function getContactStatusModuleField(overrides = {}) {
  return {
    key: 'contact_status',
    label: 'Contact Status',
    dataType: 'Picklist',
    keyField: false,
    required: false,
    options: [...DEFAULT_CONTACT_STATUS_OPTIONS.map((opt) => ({ ...opt }))],
    defaultValue: null,
    visibility: { list: true, detail: true },
    owner: 'platform',
    context: 'sales',
    appKey: 'SALES',
    filterable: false,
    filterType: null,
    filterPriority: null,
    dependencies: [contactStatusVisibilityDependency()],
    validations: [],
    lookupSettings: null,
    index: false,
    placeholder: '',
    order: 0,
    ...overrides,
  };
}

function getPeopleParticipationStatusModuleFields() {
  return [getLeadStatusModuleField(), getContactStatusModuleField()];
}

function hasConfiguredPicklistOptions(options) {
  return Array.isArray(options) && options.length > 0;
}

/**
 * Ensure lead_status and contact_status exist as Picklist module fields with defaults.
 * Preserves tenant-configured picklist options when present.
 */
function ensurePeopleParticipationStatusFields(fields) {
  if (!Array.isArray(fields)) return fields;

  const out = fields.map((f) => ({ ...f }));
  const specs = [
    { canonical: 'lead_status', factory: getLeadStatusModuleField },
    { canonical: 'contact_status', factory: getContactStatusModuleField },
  ];

  for (const { canonical, factory } of specs) {
    const idx = out.findIndex((f) => fieldKeyCanonical(f?.key) === fieldKeyCanonical(canonical));
    const defaults = factory();

    if (idx === -1) {
      out.push(defaults);
      continue;
    }

    const existing = out[idx];
    out[idx] = {
      ...defaults,
      ...existing,
      key: defaults.key,
      label: existing.label || defaults.label,
      dataType: 'Picklist',
      appKey: existing.appKey || defaults.appKey,
      context: normalizeParticipationFieldContext(existing).context || defaults.context,
      owner: existing.owner || defaults.owner,
      options: hasConfiguredPicklistOptions(existing.options)
        ? applyDefaultColorsToPicklistOptions(canonical, existing.options)
        : defaults.options.map((opt) => ({ ...opt })),
      dependencies:
        Array.isArray(existing.dependencies) && existing.dependencies.length > 0
          ? existing.dependencies
          : defaults.dependencies,
      visibility: existing.visibility || defaults.visibility,
    };
  }

  return dedupeFieldsByKey(out);
}

module.exports = {
  DEFAULT_LEAD_STATUS_VALUES,
  DEFAULT_CONTACT_STATUS_VALUES,
  DEFAULT_LEAD_STATUS_OPTIONS,
  DEFAULT_CONTACT_STATUS_OPTIONS,
  getLeadStatusModuleField,
  getContactStatusModuleField,
  getPeopleParticipationStatusModuleFields,
  ensurePeopleParticipationStatusFields,
  normalizeParticipationFieldContext,
};
