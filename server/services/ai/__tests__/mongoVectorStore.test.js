const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createVectorStore } = require('../vector/vectorStoreRegistry');
const { buildAtlasVectorSearchPipeline } = require('../vector/mongoVectorStore');

describe('mongoVectorStore', () => {
  it('selects atlas and mongo backends explicitly', () => {
    assert.equal(createVectorStore('atlas').backend, 'atlas');
    assert.equal(createVectorStore('mongo').backend, 'mongo');
  });

  it('builds Atlas vector search with tenant and corpus filters', () => {
    const pipeline = buildAtlasVectorSearchPipeline({
      organizationId: 'org-1',
      vector: [0.1, 0.2],
      topK: 3,
      filters: {
        sourceType: 'document',
        moduleKey: 'documents',
      },
      indexName: 'custom_ai_index',
    });

    assert.equal(pipeline[0].$vectorSearch.index, 'custom_ai_index');
    assert.equal(pipeline[0].$vectorSearch.path, 'embedding');
    assert.deepEqual(pipeline[0].$vectorSearch.filter, {
      organizationId: 'org-1',
      sourceType: 'document',
      moduleKey: 'documents',
    });
    assert.equal(pipeline[0].$vectorSearch.limit, 3);
    assert.deepEqual(pipeline[1].$project.score, { $meta: 'vectorSearchScore' });
  });
});
