/**
 * Optional entity fields persisted on notifications for rich in-app UI (toasts, list).
 * No PII beyond what is already in title/body copy.
 */
const ENTITY_DISPLAY_KEYS = [
  'title',
  'caseId',
  'authorName',
  'preview',
  'subject',
  'fromAddress',
  'chatSessionId',
  'sessionKey',
  'status',
  'priority',
  'moduleKey',
  'spaceId',
  'spaceName',
  'threadRootId',
];

const MAX_LEN = {
  title: 240,
  caseId: 64,
  authorName: 120,
  preview: 280,
  subject: 240,
  fromAddress: 200,
  chatSessionId: 64,
  sessionKey: 32,
  status: 64,
  priority: 32,
  moduleKey: 64,
  spaceId: 64,
  spaceName: 120,
  threadRootId: 64,
};

function trimField(key, value) {
  const max = MAX_LEN[key] || 200;
  return String(value).trim().slice(0, max);
}

/**
 * @param {object|null|undefined} entity
 * @returns {{ type?: string, id?: import('mongoose').Types.ObjectId } & Record<string, string>|undefined}
 */
function pickEntityForStorage(entity) {
  if (!entity?.type || !entity?.id) return undefined;

  const out = {
    type: String(entity.type),
    id: entity.id
  };

  for (const key of ENTITY_DISPLAY_KEYS) {
    if (entity[key] == null || entity[key] === '') continue;
    out[key] = trimField(key, entity[key]);
  }

  return out;
}

/**
 * Serialize entity for API / SSE (string id).
 */
function serializeEntityForClient(entity) {
  if (!entity) return null;
  const out = {
    type: entity.type || null,
    id: entity.id != null ? String(entity.id) : null
  };
  for (const key of ENTITY_DISPLAY_KEYS) {
    if (entity[key] != null && entity[key] !== '') {
      out[key] = String(entity[key]);
    }
  }
  return out;
}

module.exports = {
  ENTITY_DISPLAY_KEYS,
  pickEntityForStorage,
  serializeEntityForClient
};
