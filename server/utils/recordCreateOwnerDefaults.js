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
  forms: ['assignedTo'],
  targets: ['ownerId']
};

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
  const ownerKeys = MODULE_CREATE_OWNER_FIELDS[moduleKey];
  if (!ownerKeys?.length) return body;

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
  applyCreateOwnerDefaults
};
