const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildSectionClonePayloads,
  mapClonedSectionIds
} = require('../../services/quoteSectionService');

test('buildSectionClonePayloads: strips ids and resets lock for target quote', () => {
  const source = [
    {
      _id: 'sec-old-1',
      quoteSectionId: 'uuid-1',
      quoteId: 'quote-old',
      sectionTitle: 'Hardware',
      sectionOrder: 0,
      lockedSnapshot: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02')
    }
  ];

  const payloads = buildSectionClonePayloads(source, 'quote-new');
  assert.equal(payloads.length, 1);
  assert.equal(payloads[0]._id, undefined);
  assert.equal(payloads[0].quoteSectionId, undefined);
  assert.equal(payloads[0].quoteId, 'quote-new');
  assert.equal(payloads[0].sectionTitle, 'Hardware');
  assert.equal(payloads[0].lockedSnapshot, false);
  assert.equal(payloads[0].createdAt, undefined);
});

test('mapClonedSectionIds: preserves order mapping', () => {
  const source = [{ _id: 'a' }, { _id: 'b' }];
  const created = [{ _id: 'a2' }, { _id: 'b2' }];
  const map = mapClonedSectionIds(source, created);
  assert.equal(map.get('a').toString(), 'a2');
  assert.equal(map.get('b').toString(), 'b2');
});
