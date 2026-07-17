const { cosineSimilarity, normalizeChunk } = require('./vectorMath');

/**
 * In-memory VectorStorePort implementation (tests / local).
 * Enforces organizationId filter on every search.
 */
function createInMemoryVectorStore() {
  /** @type {Map<string, ReturnType<typeof normalizeChunk>>} */
  const byChunkId = new Map();

  return {
    backend: 'memory',

    async upsert(chunks) {
      for (const raw of chunks || []) {
        const chunk = normalizeChunk(raw);
        if (!chunk.organizationId || !chunk.chunkId) continue;
        byChunkId.set(`${chunk.organizationId}:${chunk.chunkId}`, chunk);
      }
    },

    async deleteBySource(organizationId, sourceType, sourceId) {
      const orgId = String(organizationId);
      const type = String(sourceType);
      const id = String(sourceId);
      for (const [key, chunk] of byChunkId.entries()) {
        if (
          chunk.organizationId === orgId
          && chunk.sourceType === type
          && chunk.sourceId === id
        ) {
          byChunkId.delete(key);
        }
      }
    },

    async search({ organizationId, vector, topK = 8, filters = {} }) {
      const orgId = String(organizationId);
      const hits = [];
      for (const chunk of byChunkId.values()) {
        if (chunk.organizationId !== orgId) continue;
        if (filters.sourceType && chunk.sourceType !== filters.sourceType) continue;
        if (filters.appKey && chunk.appKey !== filters.appKey) continue;
        if (filters.moduleKey && chunk.moduleKey !== filters.moduleKey) continue;
        hits.push({
          chunkId: chunk.chunkId,
          sourceType: chunk.sourceType,
          sourceId: chunk.sourceId,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          score: cosineSimilarity(vector, chunk.embedding),
          appKey: chunk.appKey,
          moduleKey: chunk.moduleKey,
        });
      }
      return hits
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(1, Number(topK) || 8));
    },
  };
}

module.exports = {
  createInMemoryVectorStore,
};
