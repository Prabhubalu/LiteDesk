'use strict';

/**
 * Print Atlas Vector Search index definition for AiVectorChunk.
 *
 * Usage:
 *   node server/scripts/printAiAtlasVectorIndex.js
 *
 * Apply in Atlas UI (Search → Create Index → JSON Editor) on the
 * `aivectorchunks` collection (or tenant DB equivalent), or via Atlas Admin API.
 *
 * Env:
 *   AI_ATLAS_VECTOR_INDEX  — override index name (default: ai_vector_chunks_embedding)
 *   AI_EMBEDDING_DIMENSIONS — override dims (default: 1536 for text-embedding-3-small)
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_INDEX = 'ai_vector_chunks_embedding';
const DEFAULT_DIMS = 1536;

function loadIndexDefinition({
  indexName = process.env.AI_ATLAS_VECTOR_INDEX || DEFAULT_INDEX,
  numDimensions = Number(process.env.AI_EMBEDDING_DIMENSIONS || DEFAULT_DIMS),
} = {}) {
  const filePath = path.join(__dirname, 'atlas', 'ai_vector_chunks_embedding.json');
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  raw.name = indexName || DEFAULT_INDEX;
  const vectorField = (raw.fields || []).find((f) => f.type === 'vector');
  if (vectorField && Number.isFinite(numDimensions) && numDimensions > 0) {
    vectorField.numDimensions = numDimensions;
  }
  return raw;
}

function main() {
  const definition = loadIndexDefinition();
  console.log(JSON.stringify(definition, null, 2));
  console.error(`
[ai-atlas-index] Apply this JSON as an Atlas Vector Search index on collection aivectorchunks.
[ai-atlas-index] Set AI_VECTOR_STORE=atlas and AI_ATLAS_VECTOR_INDEX=${definition.name}
[ai-atlas-index] Until the index exists, mongoVectorStore falls back to in-process cosine ranking.
`);
}

module.exports = {
  loadIndexDefinition,
  DEFAULT_INDEX,
  DEFAULT_DIMS,
};

if (require.main === module) {
  main();
}
