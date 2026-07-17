const AiVectorChunk = require('../../../models/AiVectorChunk');
const { cosineSimilarity, normalizeChunk } = require('./vectorMath');

const DEFAULT_VECTOR_INDEX = 'ai_vector_chunks_embedding';

/**
 * Build the Atlas Vector Search pipeline with mandatory organizationId filter.
 */
function buildAtlasVectorSearchPipeline({
  organizationId,
  vector,
  topK = 8,
  filters = {},
  indexName = DEFAULT_VECTOR_INDEX,
}) {
  const filter = { organizationId };
  if (filters.sourceType) filter.sourceType = filters.sourceType;
  if (filters.appKey) filter.appKey = filters.appKey;
  if (filters.moduleKey) filter.moduleKey = filters.moduleKey;

  return [
    {
      $vectorSearch: {
        index: indexName,
        path: 'embedding',
        queryVector: vector,
        numCandidates: Math.max(50, Number(topK || 8) * 20),
        limit: Math.max(1, Number(topK) || 8),
        filter,
      },
    },
    {
      $project: {
        _id: 0,
        chunkId: 1,
        sourceType: 1,
        sourceId: 1,
        chunkIndex: 1,
        text: 1,
        appKey: 1,
        moduleKey: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ];
}

async function searchWithCosineFallback({ organizationId, vector, topK = 8, filters = {} }) {
  const query = {
    organizationId,
    embedding: { $exists: true, $ne: null },
  };
  if (filters.sourceType) query.sourceType = filters.sourceType;
  if (filters.appKey) query.appKey = filters.appKey;
  if (filters.moduleKey) query.moduleKey = filters.moduleKey;

  const docs = await AiVectorChunk.find(query)
    .select('chunkId sourceType sourceId chunkIndex text embedding appKey moduleKey')
    .limit(500)
    .lean();

  return docs
    .map((doc) => ({
      chunkId: doc.chunkId,
      sourceType: doc.sourceType,
      sourceId: doc.sourceId,
      chunkIndex: doc.chunkIndex,
      text: doc.text,
      score: cosineSimilarity(vector, doc.embedding || []),
      appKey: doc.appKey,
      moduleKey: doc.moduleKey,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Number(topK) || 8));
}

/**
 * Mongo-backed VectorStorePort.
 * `atlas` uses Atlas $vectorSearch; `mongo` keeps the local cosine fallback.
 */
function createMongoVectorStore({ useAtlasVectorSearch = false } = {}) {
  const indexName = process.env.AI_ATLAS_VECTOR_INDEX || DEFAULT_VECTOR_INDEX;

  return {
    backend: useAtlasVectorSearch ? 'atlas' : 'mongo',

    async upsert(chunks) {
      const rows = (chunks || []).map(normalizeChunk).filter((c) => c.organizationId && c.chunkId);
      await Promise.all(rows.map(async (chunk) => {
        await AiVectorChunk.findOneAndUpdate(
          {
            organizationId: chunk.organizationId,
            chunkId: chunk.chunkId,
          },
          {
            $set: {
              organizationId: chunk.organizationId,
              sourceType: chunk.sourceType,
              sourceId: chunk.sourceId,
              chunkId: chunk.chunkId,
              chunkIndex: chunk.chunkIndex,
              text: chunk.text,
              embedding: chunk.embedding,
              embeddingModel: chunk.embeddingModel,
              embeddingVersion: chunk.embeddingVersion,
              contentHash: chunk.contentHash,
              appKey: chunk.appKey,
              moduleKey: chunk.moduleKey,
            },
          },
          { upsert: true, new: true }
        );
      }));
    },

    async deleteBySource(organizationId, sourceType, sourceId) {
      await AiVectorChunk.deleteMany({
        organizationId,
        sourceType,
        sourceId: String(sourceId),
      });
    },

    async search({ organizationId, vector, topK = 8, filters = {} }) {
      if (!organizationId) return [];
      if (!Array.isArray(vector) || vector.length === 0) return [];

      if (useAtlasVectorSearch) {
        const pipeline = buildAtlasVectorSearchPipeline({
          organizationId,
          vector,
          topK,
          filters,
          indexName,
        });

        try {
          return await AiVectorChunk.aggregate(pipeline);
        } catch (error) {
          console.warn('[AI VectorStore] Atlas $vectorSearch failed; falling back to cosine ranking:', error.message);
        }
      }

      return searchWithCosineFallback({ organizationId, vector, topK, filters });
    },
  };
}

module.exports = {
  createMongoVectorStore,
  buildAtlasVectorSearchPipeline,
};
