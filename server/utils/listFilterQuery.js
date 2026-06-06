const { applyFilterQueryToMongoQuery } = require('./filterQueryCompiler');

/**
 * Applies client filterQuery AST param to a Mongo list query.
 * @param {object} query
 * @param {Record<string, unknown>} params
 * @param {string} moduleKey
 */
function applyListFilterQueryParam(query, params, moduleKey, context = {}) {
  if (!params?.filterQuery) return query;
  return applyFilterQueryToMongoQuery(query, params.filterQuery, moduleKey, context);
}

module.exports = {
  applyListFilterQueryParam,
};
