/**
 * Field eligibility for bulk / mass edit.
 * Keeps lifecycle, computed, and high-risk fields off the bulk path.
 */

const RESERVED_KEYS = new Set([
  '_id', '__v', 'organizationId', 'createdAt', 'updatedAt', 'createdBy',
  'modifiedBy', 'deletedAt', 'deletedBy', 'deletionReason', 'source',
  'playbookState', 'stageHistory', 'activities', 'comments',
  'descriptionVersions', 'currentSlaCycle', 'assignmentControl',
]);

const NON_BULK_DATA_TYPES = new Set([
  'text-area',
  'rich text',
  'image',
  'file',
  'auto-number',
  'formula',
  'rollup summary',
]);

/** Fields denied per module (normalized lowercase keys). */
const MODULE_DENIED_FIELDS = {
  deals: new Set(['stage', 'pipeline', 'stageorder', 'status', 'playbookstate']),
  events: new Set(['status', 'eventstatus', 'executionstate', 'relatedrecordtype', 'relatedrecordid']),
  tasks: new Set(['relatedto', 'relatedtotype', 'relatedtoid', 'status']),
  cases: new Set(['status', 'casenumber', 'slacycle', 'currentslacycle']),
  people: new Set(['participations']),
  organizations: new Set(['istenant']),
  quotes: new Set(['status', 'approvalstatus', 'revisionnumber']),
};

const BULK_UPDATE_MODULES = new Set([
  'people',
  'organizations',
  'deals',
  'tasks',
  'events',
  'items',
  'cases',
  'quotes',
]);

function normalizeKey(key) {
  return String(key || '').trim().toLowerCase();
}

function isBulkUpdateModule(moduleKey) {
  return BULK_UPDATE_MODULES.has(normalizeKey(moduleKey));
}

function isFieldDeniedForBulkUpdate(moduleKey, fieldKey, fieldDef) {
  const key = normalizeKey(fieldKey);
  if (!key || RESERVED_KEYS.has(key)) return true;
  if (MODULE_DENIED_FIELDS[normalizeKey(moduleKey)]?.has(key)) return true;

  const dataType = String(fieldDef?.dataType || '').trim().toLowerCase();
  if (NON_BULK_DATA_TYPES.has(dataType)) return true;
  if (dataType.includes('rich')) return true;

  return false;
}

function filterAllowedBulkUpdates(moduleKey, updates, moduleFields) {
  const mk = normalizeKey(moduleKey);
  const fields = Array.isArray(moduleFields) ? moduleFields : [];
  const fieldByKey = new Map(
    fields
      .filter((f) => f?.key)
      .map((f) => [normalizeKey(f.key), f])
  );

  const allowed = {};
  const denied = [];

  for (const [rawKey, value] of Object.entries(updates || {})) {
    const key = normalizeKey(rawKey);
    if (!key) continue;
    const fieldDef = fieldByKey.get(key) || null;
    if (isFieldDeniedForBulkUpdate(mk, key, fieldDef)) {
      denied.push(rawKey);
      continue;
    }
    allowed[rawKey] = value;
  }

  return { allowed, denied };
}

module.exports = {
  BULK_UPDATE_MODULES,
  RESERVED_KEYS,
  isBulkUpdateModule,
  isFieldDeniedForBulkUpdate,
  filterAllowedBulkUpdates,
};
