/**
 * Lightweight record updatedAt probe for client cache validation.
 */

const UPDATED_AT_CANDIDATES = ['updatedAt', 'modifiedTime', 'updated_at', 'modified_at'];

function pickUpdatedAtValue(doc) {
  if (!doc || typeof doc !== 'object') return null;
  for (const key of UPDATED_AT_CANDIDATES) {
    if (doc[key] != null) return doc[key];
  }
  return null;
}

async function fetchRecordUpdatedAtMeta(Model, { organizationId, recordId, extraQuery = {} }) {
  if (!Model || !organizationId || !recordId) return null;

  const doc = await Model.findOne({
    _id: recordId,
    organizationId,
    deletedAt: null,
    ...extraQuery,
  })
    .select(UPDATED_AT_CANDIDATES.join(' '))
    .lean();

  if (!doc) return null;

  const raw = pickUpdatedAtValue(doc);
  return {
    updatedAt: raw ? new Date(raw).toISOString() : null,
  };
}

function sendRecordMetaResponse(res, meta) {
  res.set('Cache-Control', 'no-store');
  if (!meta) {
    res.status(404).json({ success: false, message: 'Record not found' });
    return;
  }
  res.status(200).json({ success: true, data: meta });
}

module.exports = {
  fetchRecordUpdatedAtMeta,
  sendRecordMetaResponse,
  pickUpdatedAtValue,
};
