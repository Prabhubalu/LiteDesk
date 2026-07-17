'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadIndexDefinition, DEFAULT_INDEX, DEFAULT_DIMS } = require('../printAiAtlasVectorIndex');

describe('printAiAtlasVectorIndex', () => {
  it('loads Atlas vector index JSON with org filter and cosine vector field', () => {
    const definition = loadIndexDefinition();
    assert.equal(definition.name, DEFAULT_INDEX);
    assert.equal(definition.type, 'vectorSearch');
    const vector = definition.fields.find((f) => f.type === 'vector');
    assert.equal(vector.path, 'embedding');
    assert.equal(vector.numDimensions, DEFAULT_DIMS);
    assert.equal(vector.similarity, 'cosine');
    assert.ok(definition.fields.some((f) => f.type === 'filter' && f.path === 'organizationId'));
  });

  it('honors AI_EMBEDDING_DIMENSIONS override', () => {
    const definition = loadIndexDefinition({ numDimensions: 3072, indexName: 'custom_idx' });
    assert.equal(definition.name, 'custom_idx');
    assert.equal(definition.fields.find((f) => f.type === 'vector').numDimensions, 3072);
  });
});
