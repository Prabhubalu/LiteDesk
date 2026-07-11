/**
 * CommercialConversionService — Deal → document DTO boundary (no Quote coupling).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { convertDealToQuoteDraft } = require('../commercialConversionService');

describe('commercialConversionService (unit shape)', () => {
  it('exports convertDealToQuoteDraft', () => {
    assert.equal(typeof convertDealToQuoteDraft, 'function');
  });
});
