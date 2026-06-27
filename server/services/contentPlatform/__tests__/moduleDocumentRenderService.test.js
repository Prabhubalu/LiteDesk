'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  renderModuleDocumentWithMode,
  computeChecksum
} = require('../moduleDocumentRenderService');

describe('moduleDocumentRenderService', () => {
  it('computeChecksum returns stable sha256 hex', () => {
    const buffer = Buffer.from('test-pdf-bytes');
    const checksum = computeChecksum(buffer);
    assert.match(checksum, /^[a-f0-9]{64}$/);
    assert.equal(checksum, computeChecksum(buffer));
  });

  it('legacy mode returns legacy buffer only', async () => {
    const legacyBuffer = Buffer.from('legacy-pdf');
    const result = await renderModuleDocumentWithMode({
      moduleKey: 'quotes',
      organizationId: 'org-1',
      recordId: 'quote-1',
      renderLegacy: async () => legacyBuffer
    });

    assert.equal(result, legacyBuffer);
  });
});
