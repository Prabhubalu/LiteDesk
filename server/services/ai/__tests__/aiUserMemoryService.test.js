'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { serializeMemory } = require('../aiUserMemoryService');

describe('aiUserMemoryService', () => {
  it('serializes empty memory defaults', () => {
    const mem = serializeMemory(null);
    assert.equal(mem.preferOpenFirst, true);
    assert.equal(mem.amountThreshold, null);
    assert.deepEqual(mem.dismissedFingerprints, []);
    assert.equal(mem.lastModuleKey, '');
  });

  it('serializes stored memory fields', () => {
    const mem = serializeMemory({
      preferOpenFirst: false,
      amountThreshold: 10000,
      preferredChart: 'pie',
      dismissedFingerprints: ['follow_up:deals:abc:stale_deal'],
      lastModuleKey: 'deals',
      lastRecordId: '507f1f77bcf86cd799439011',
      lastRecordTitle: 'Acme',
    });
    assert.equal(mem.preferOpenFirst, false);
    assert.equal(mem.amountThreshold, 10000);
    assert.equal(mem.preferredChart, 'pie');
    assert.equal(mem.lastRecordTitle, 'Acme');
    assert.equal(mem.dismissedFingerprints.length, 1);
  });
});
