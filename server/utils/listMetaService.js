/**
 * Lightweight list fingerprints for client cache validation.
 */

async function fetchListMeta(Model, query, options = {}) {
  const updatedAtField = options.updatedAtField || 'updatedAt';
  const sort = { [updatedAtField]: -1 };

  const [totalRecords, latestDoc] = await Promise.all([
    Model.countDocuments(query),
    Model.findOne(query).sort(sort).select(updatedAtField).lean(),
  ]);

  const raw = latestDoc?.[updatedAtField];
  return {
    totalRecords,
    maxUpdatedAt: raw ? new Date(raw).toISOString() : null,
  };
}

function sendListMetaResponse(res, meta) {
  res.set('Cache-Control', 'no-store');
  res.status(200).json({ success: true, data: meta });
}

async function handleListMetaRequest(res, buildQuery, Model, options = {}) {
  const query = typeof buildQuery === 'function' ? await buildQuery() : buildQuery;
  const meta = await fetchListMeta(Model, query, options);
  sendListMetaResponse(res, meta);
}

module.exports = {
  fetchListMeta,
  sendListMetaResponse,
  handleListMetaRequest,
};
