/**
 * Merge sharing / legacy ownership filters into list queries.
 */

const { getOwnerFieldForModule } = require('../services/sharingResolver');

/**
 * @param {object} query — Mongoose query object (mutated)
 * @param {object} req — Express request with sharingFilter or filterByUser
 * @param {string} moduleKey
 */
function applyListSharingToQuery(query, req, moduleKey) {
  if (!query || !req) return query;

  if (req.sharingFilter && Object.keys(req.sharingFilter).length > 0) {
    if (!query.$and) query.$and = [];
    query.$and.push(req.sharingFilter);
    return query;
  }

  if (req.filterByUser) {
    const ownerField = req.sharingOwnerField || getOwnerFieldForModule(moduleKey);
    query[ownerField] = req.filterByUser;
  }

  return query;
}

module.exports = {
  applyListSharingToQuery
};
