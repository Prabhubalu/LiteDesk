'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateFormat,
  renderNumber,
  computePeriodKey,
  preview,
  extractSequenceFromValue,
  ModuleNumberingError,
} = require('../moduleNumberingService');

describe('moduleNumberingService.validateFormat', () => {
  it('requires exactly one {SEQ}', () => {
    assert.equal(validateFormat('SO-{SEQ}').ok, true);
    assert.equal(validateFormat('SO-{YYYY}-{SEQ}').ok, true);
    assert.equal(validateFormat('SO-{SEQ}-{SEQ}').ok, false);
    assert.equal(validateFormat('SO-ONLY').ok, false);
  });

  it('rejects unsupported tokens', () => {
    const result = validateFormat('SO-{FY}-{SEQ}');
    assert.equal(result.ok, false);
    assert.match(result.message, /Unsupported/);
  });

  it('rejects invalid characters', () => {
    assert.equal(validateFormat('SO@{SEQ}').ok, false);
  });
});

describe('moduleNumberingService.renderNumber', () => {
  it('pads sequence and substitutes tokens', () => {
    const at = new Date(Date.UTC(2026, 6, 22));
    const value = renderNumber({
      format: '{PREFIX}/{YYYY}/{MM}/{SEQ}{SUFFIX}',
      prefix: 'INV',
      suffix: 'X',
      sequence: 45,
      sequenceLength: 6,
      at,
    });
    assert.equal(value, 'INV/2026/07/000045X');
  });
});

describe('moduleNumberingService.computePeriodKey', () => {
  const at = new Date(Date.UTC(2026, 6, 22));
  it('maps reset rules', () => {
    assert.equal(computePeriodKey('never', at), '');
    assert.equal(computePeriodKey('yearly', at), '2026');
    assert.equal(computePeriodKey('monthly', at), '2026-07');
    assert.equal(computePeriodKey('daily', at), '2026-07-22');
  });
});

describe('moduleNumberingService.preview', () => {
  it('uses max(current+1, starting)', () => {
    const value = preview({
      format: 'QT-{SEQ}',
      sequenceLength: 4,
      currentSequence: 10,
      startingSequence: 1,
    });
    assert.equal(value, 'QT-0011');
  });

  it('throws on invalid format', () => {
    assert.throws(
      () => preview({ format: 'NO-SEQ' }),
      (err) => err instanceof ModuleNumberingError && err.code === 'INVALID_FORMAT'
    );
  });
});

describe('moduleNumberingService.extractSequenceFromValue', () => {
  it('parses via format template (not arbitrary trailing digits)', () => {
    assert.equal(
      extractSequenceFromValue('SO-2026-000123', { format: 'SO-{YYYY}-{SEQ}' }),
      123
    );
    assert.equal(
      extractSequenceFromValue('INV/2026/07/000045', { format: 'INV/{YYYY}/{MM}/{SEQ}' }),
      45
    );
    assert.equal(extractSequenceFromValue('QT-0003', { format: 'QT-{SEQ}' }), 3);
    // Demo / foreign formats must not inflate the sequence
    assert.equal(
      extractSequenceFromValue('QT-MR54T40F-010', { format: 'QT-{SEQ}' }),
      null
    );
    assert.equal(
      extractSequenceFromValue('ITM-6a439b24f2c6501a7a3b13a9', { format: 'ITM-{SEQ}' }),
      null
    );
    assert.equal(
      extractSequenceFromValue('SKU-MR54T40F-010', { format: 'ITM-{SEQ}' }),
      null
    );
    assert.equal(extractSequenceFromValue('', { format: 'QT-{SEQ}' }), null);
  });
});
