'use strict';

function mergePortalKnowledgeRows(legacyRows = [], studioRows = []) {
  return [...legacyRows, ...studioRows].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

module.exports = {
  mergePortalKnowledgeRows,
};
