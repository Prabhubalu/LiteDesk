'use strict';

const Document = require('../models/Document');
const {
  buildEmbedding,
  cosineSimilarity,
  buildDocumentSemanticSource
} = require('../constants/documentSemanticSearch');
const { applyDocumentVisibilityFilter } = require('../utils/documentVisibility');

const DEFAULT_LIMIT = 20;
const MAX_CANDIDATES = 500;

async function indexDocumentSemanticEmbedding({ organizationId, documentId, doc = null }) {
  const row = doc || await Document.findOne({
    _id: documentId,
    organizationId,
    deletedAt: null
  }).lean();

  if (!row) return null;

  const source = buildDocumentSemanticSource(row);
  const searchEmbedding = buildEmbedding(source);

  await Document.updateOne(
    { _id: documentId, organizationId },
    {
      $set: {
        searchEmbedding,
        semanticIndexedAt: new Date()
      }
    }
  );

  return searchEmbedding;
}

async function semanticSearchDocuments({
  organizationId,
  queryText,
  page = 1,
  limit = DEFAULT_LIMIT,
  visibilityContext = null
}) {
  const searchTerm = String(queryText || '').trim();
  if (!searchTerm) {
    return { data: [], pagination: { page, limit, total: 0, totalPages: 1 } };
  }

  const queryEmbedding = buildEmbedding(searchTerm);
  const baseQuery = {
    organizationId,
    deletedAt: null,
    searchEmbedding: { $exists: true, $ne: null }
  };

  if (visibilityContext) {
    applyDocumentVisibilityFilter(baseQuery, visibilityContext);
  }

  const candidates = await Document.find(baseQuery)
    .select('_id title documentNumber documentType status updatedAt searchEmbedding folderId assignedTo')
    .populate('folderId', 'name path')
    .sort({ updatedAt: -1 })
    .limit(MAX_CANDIDATES)
    .lean();

  const scored = candidates
    .map((doc) => ({
      doc,
      score: cosineSimilarity(queryEmbedding, doc.searchEmbedding || [])
    }))
    .filter((row) => row.score > 0.05)
    .sort((a, b) => b.score - a.score);

  const total = scored.length;
  const skip = Math.max((page - 1) * limit, 0);
  const pageRows = scored.slice(skip, skip + limit);

  return {
    data: pageRows.map((row) => ({
      ...row.doc,
      semanticScore: Number(row.score.toFixed(4)),
      folderName: row.doc.folderId?.name || null
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    }
  };
}

module.exports = {
  indexDocumentSemanticEmbedding,
  semanticSearchDocuments
};
