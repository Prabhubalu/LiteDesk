function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function normalizeChunk(chunk) {
  return {
    organizationId: String(chunk.organizationId),
    sourceType: String(chunk.sourceType),
    sourceId: String(chunk.sourceId),
    chunkId: String(chunk.chunkId),
    chunkIndex: Number(chunk.chunkIndex || 0),
    text: String(chunk.text || ''),
    embedding: Array.isArray(chunk.embedding) ? chunk.embedding : [],
    embeddingModel: chunk.embeddingModel || null,
    embeddingVersion: Number(chunk.embeddingVersion || 1),
    contentHash: chunk.contentHash || null,
    appKey: chunk.appKey || null,
    moduleKey: chunk.moduleKey || null,
    updatedAt: chunk.updatedAt || new Date(),
  };
}

module.exports = {
  cosineSimilarity,
  normalizeChunk,
};
