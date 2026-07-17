const { createInMemoryVectorStore } = require('./inMemoryVectorStore');
const { createMongoVectorStore } = require('./mongoVectorStore');
const { AiConfigurationError } = require('../errors');

let singleton = null;

/**
 * Resolve VectorStorePort from AI_VECTOR_STORE env.
 * atlas → Mongo AiVectorChunk + Atlas $vectorSearch
 * mongo → Mongo AiVectorChunk + in-process cosine fallback
 * memory → in-memory (tests)
 */
function createVectorStore(backend = process.env.AI_VECTOR_STORE || 'atlas') {
  const normalized = String(backend || 'atlas').trim().toLowerCase();
  if (normalized === 'memory') return createInMemoryVectorStore();
  if (normalized === 'atlas') return createMongoVectorStore({ useAtlasVectorSearch: true });
  if (normalized === 'mongo') return createMongoVectorStore({ useAtlasVectorSearch: false });
  if (normalized === 'qdrant') {
    throw new AiConfigurationError(
      'Qdrant vector store is not implemented yet',
      'AI_VECTOR_STORE_NOT_CONFIGURED'
    );
  }
  throw new AiConfigurationError(
    `Unknown AI_VECTOR_STORE=${normalized}`,
    'AI_VECTOR_STORE_INVALID'
  );
}

function getVectorStore() {
  if (!singleton) {
    singleton = createVectorStore();
  }
  return singleton;
}

function resetVectorStoreForTests() {
  singleton = null;
}

module.exports = {
  createVectorStore,
  getVectorStore,
  resetVectorStoreForTests,
};
