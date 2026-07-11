/**
 * Organization type → field visibility (server mirror of client organizationFieldModel).
 */

const {
  ORGANIZATION_ALWAYS_VISIBLE_FIELD_KEYS,
  normalizeFieldKey,
  platformDefaultFieldsForType,
  getOrganizationTypeScopedFieldPool,
} = require('../constants/organizationTypeDefaults');

/** Fields never accepted on CRM organization create/update APIs. */
const ORGANIZATION_SUBMIT_BLOCKED_FIELD_KEYS = new Set([
  '_id',
  '__v',
  'organizationId',
  'createdAt',
  'updatedAt',
  'createdBy',
  'modifiedBy',
  'assignedTo',
  'derivedStatus',
  'deletedAt',
  'deletedBy',
  'deletionReason',
  'activityLogs',
  'legacyOrganizationId',
  'isTenant',
  'slug',
  'enabledApps',
  'enabledModules',
  'subscription',
  'limits',
  'settings',
  'security',
  'billing',
  'database',
  'integrations',
  'moduleOverrides',
  'crmInitialized',
  'dataRegion',
  'importHistoryId',
]);

function normalizeOrgTypeLabel(type) {
  return String(type ?? '').trim();
}

function findOrganizationTypeDef(type, typeDefs) {
  const want = normalizeOrgTypeLabel(type).toLowerCase();
  if (!want || !Array.isArray(typeDefs) || !typeDefs.length) return undefined;
  return typeDefs.find((d) => normalizeOrgTypeLabel(d?.value ?? '').toLowerCase() === want);
}

function getOrganizationFieldsForType(type, typeDefs) {
  const match = findOrganizationTypeDef(type, typeDefs);
  if (match && match.fields !== undefined) {
    return Array.isArray(match.fields) ? [...match.fields] : [];
  }
  return platformDefaultFieldsForType(type);
}

function getOrganizationFieldsForTypes(selectedTypes, typeDefs) {
  const types = (selectedTypes ?? []).map(normalizeOrgTypeLabel).filter(Boolean);
  if (!types.length) return [];
  const out = new Set();
  for (const type of types) {
    for (const fieldKey of getOrganizationFieldsForType(type, typeDefs)) {
      out.add(fieldKey);
    }
  }
  return [...out];
}

function isOrganizationAlwaysVisibleField(fieldKey) {
  const k = normalizeFieldKey(fieldKey);
  for (const always of ORGANIZATION_ALWAYS_VISIBLE_FIELD_KEYS) {
    if (normalizeFieldKey(always) === k) return true;
  }
  return false;
}

function isOrganizationTypeScopedFieldKey(fieldKey) {
  if (isOrganizationAlwaysVisibleField(fieldKey)) return false;
  const k = normalizeFieldKey(fieldKey);
  return getOrganizationTypeScopedFieldPool().some((p) => normalizeFieldKey(p) === k);
}

function shouldShowOrganizationFieldForTypes(fieldKey, selectedTypes, typeDefs) {
  const key = String(fieldKey ?? '').trim();
  if (!key) return false;
  if (isOrganizationAlwaysVisibleField(key)) return true;
  if (!isOrganizationTypeScopedFieldKey(key)) return true;
  const allowed = getOrganizationFieldsForTypes(selectedTypes, typeDefs);
  const nk = normalizeFieldKey(key);
  return allowed.some((f) => normalizeFieldKey(f) === nk);
}

function filterOrganizationSubmitPayloadByTypes(payload, selectedTypes, typeDefs) {
  if (!payload || typeof payload !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!shouldShowOrganizationFieldForTypes(key, selectedTypes, typeDefs)) continue;
    out[key] = value;
  }
  return out;
}

function stripBlockedOrganizationSubmitFields(payload) {
  if (!payload || typeof payload !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    if (ORGANIZATION_SUBMIT_BLOCKED_FIELD_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

/** Pick CRM-editable business fields from a stored organization document. */
function pickEditableOrganizationRecord(org) {
  if (!org || typeof org !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(org)) {
    if (ORGANIZATION_SUBMIT_BLOCKED_FIELD_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

module.exports = {
  ORGANIZATION_SUBMIT_BLOCKED_FIELD_KEYS,
  getOrganizationFieldsForTypes,
  shouldShowOrganizationFieldForTypes,
  filterOrganizationSubmitPayloadByTypes,
  stripBlockedOrganizationSubmitFields,
  pickEditableOrganizationRecord,
};
