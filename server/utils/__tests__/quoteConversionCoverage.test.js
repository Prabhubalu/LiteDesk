const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeConversionCoverage,
  resolveQuoteConversionCoverage,
  resolveQuoteStatusAfterConversion
} = require('../../services/quoteConversionCoverageService');

test('computeConversionCoverage: none partial full', () => {
  assert.equal(computeConversionCoverage(['a', 'b'], []), 'none');
  assert.equal(computeConversionCoverage(['a', 'b'], ['a']), 'partial');
  assert.equal(computeConversionCoverage(['a', 'b'], ['a', 'b']), 'full');
});

test('resolveQuoteConversionCoverage: partial maps to Partially Converted', () => {
  const quote = {
    customerResponse: { acceptedLineIds: ['l1', 'l2'] }
  };
  const resolution = resolveQuoteConversionCoverage({
    quote,
    convertedLineIds: ['l1']
  });
  assert.equal(resolution.coverage, 'partial');
  assert.equal(resolution.targetStatus, 'Partially Converted');
  assert.deepEqual(resolution.unmappedLineIds, ['l2']);
});

test('resolveQuoteStatusAfterConversion: full convert from Accepted', () => {
  const quote = { customerResponse: { acceptedLineIds: ['l1'] } };
  const resolution = resolveQuoteConversionCoverage({
    quote,
    convertedLineIds: ['l1']
  });
  assert.equal(resolveQuoteStatusAfterConversion('Accepted', resolution), 'Converted');
});

test('resolveQuoteStatusAfterConversion: partial convert from Accepted', () => {
  const quote = { customerResponse: { acceptedLineIds: ['l1', 'l2'] } };
  const resolution = resolveQuoteConversionCoverage({
    quote,
    convertedLineIds: ['l1']
  });
  assert.equal(resolveQuoteStatusAfterConversion('Accepted', resolution), 'Partially Converted');
});

test('resolveQuoteStatusAfterConversion: Partially Converted to Converted', () => {
  const quote = { customerResponse: { acceptedLineIds: ['l1', 'l2'] } };
  const resolution = resolveQuoteConversionCoverage({
    quote,
    convertedLineIds: ['l1', 'l2']
  });
  assert.equal(resolveQuoteStatusAfterConversion('Partially Converted', resolution), 'Converted');
});
