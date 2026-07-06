'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  buildRenderCacheKey,
  getCachedRender,
  setCachedRender,
  clearRenderPreviewCache
} = require('../renderers/renderPreviewCache');

describe('renderPreviewCache', () => {
  it('returns cached buffers until cleared', () => {
    clearRenderPreviewCache();
    const key = buildRenderCacheKey({ templateId: 'a', version: 1 });
    const buffer = Buffer.from('pdf-bytes');

    assert.equal(getCachedRender(key), null);
    setCachedRender(key, buffer, 'application/pdf');

    const cached = getCachedRender(key);
    assert.ok(cached);
    assert.equal(cached.mimeType, 'application/pdf');
    assert.equal(cached.buffer.toString('utf8'), 'pdf-bytes');
  });

  it('builds stable keys regardless of object key order', () => {
    const left = buildRenderCacheKey({ b: 2, a: 1 });
    const right = buildRenderCacheKey({ a: 1, b: 2 });
    assert.equal(left, right);
  });
});
