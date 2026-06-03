/** Normalize Arivu API response shapes ({ success, data } vs raw record). */

export function extractRecordId(body) {
  if (!body || typeof body !== 'object') return null;
  const candidate = body.data ?? body.record ?? body.person ?? body.deal ?? body.task ?? body;
  if (typeof candidate === 'string') return candidate;
  return candidate?._id ?? candidate?.id ?? body._id ?? body.id ?? null;
}

export function extractListRows(body) {
  if (!body) return [];
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.data)) return body.data;
  for (const key of ['people', 'deals', 'tasks', 'users', 'roles', 'groups', 'organizations', 'records', 'items']) {
    if (Array.isArray(body[key])) return body[key];
  }
  return [];
}

export function firstRecordId(body) {
  const rows = extractListRows(body);
  return rows[0]?._id ?? rows[0]?.id ?? null;
}
