/**
 * Default assigned-to / owner fields to the current user on record create.
 */
const MODULE_CREATE_OWNER_FIELDS = {
  people: ['assignedTo'],
  organizations: ['assignedTo'],
  tasks: ['assignedTo'],
  deals: ['ownerId'],
  cases: ['caseOwnerId'],
  events: ['eventOwnerId'],
  quotes: ['ownerId'],
  sales_orders: ['ownerId'],
  invoices: ['ownerId'],
  documents: ['ownerId'],
  forms: ['assignedTo'],
  targets: ['ownerId']
};

function normalizeFieldKey(fieldKey) {
  return String(fieldKey || '').trim().toLowerCase();
}

function getModuleOwnerFieldKeys(moduleKey) {
  return MODULE_CREATE_OWNER_FIELDS[String(moduleKey || '').trim().toLowerCase()] || [];
}

function isModuleOwnerField(moduleKey, fieldKey) {
  const ownerKeys = getModuleOwnerFieldKeys(moduleKey);
  const normalized = normalizeFieldKey(fieldKey);
  return ownerKeys.some((key) => normalizeFieldKey(key) === normalized);
}

function applyOwnerFieldRequiredToModuleFields(fields, moduleKey) {
  if (!Array.isArray(fields)) return fields;
  return fields.map((field) => {
    if (!isModuleOwnerField(moduleKey, field?.key)) return field;
    return { ...field, required: true };
  });
}

function isOwnerFieldValueEmpty(value) {
  return value === null || value === undefined || value === '';
}

/**
 * @param {Record<string, unknown>} body
 * @param {string} moduleKey
 * @param {import('mongoose').Types.ObjectId | string | null | undefined} userId
 * @returns {Record<string, unknown>}
 */
function applyCreateOwnerDefaults(body, moduleKey, userId) {
  if (!userId || !body || typeof body !== 'object') return body;
  const ownerKeys = getModuleOwnerFieldKeys(moduleKey);
  if (!ownerKeys.length) return body;

  const next = { ...body };
  for (const key of ownerKeys) {
    if (isOwnerFieldValueEmpty(next[key])) {
      next[key] = userId;
    }
  }
  return next;
}

module.exports = {
  MODULE_CREATE_OWNER_FIELDS,
  getModuleOwnerFieldKeys,
  isModuleOwnerField,
  applyOwnerFieldRequiredToModuleFields,
  applyCreateOwnerDefaults
};
