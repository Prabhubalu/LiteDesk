'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { normalizeDiscoveryPayload, hashPayload } = require('../metadataEngine');
const { scorePair, suggestAll } = require('../aiMappingEngine');
const { validatePayload, validateGstin, validateVoucherBalance } = require('../validationEngine');
const { applyRules, toTallyDate, fromTallyDate, toTallyYesNo } = require('../transformationEngine');
const { enrichError } = require('../errorIntelligenceEngine');

describe('ATIP metadataEngine', () => {
  it('normalizeDiscoveryPayload does not invent objects when empty', () => {
    const a = normalizeDiscoveryPayload({});
    const b = normalizeDiscoveryPayload({ objects: [] });
    assert.equal(a.objects.length, 0);
    assert.equal(b.objects.length, 0);
    assert.equal(a.thin, true);
    assert.equal(hashPayload(a), hashPayload(b));
  });

  it('normalizeDiscoveryPayload keeps live objects', () => {
    const n = normalizeDiscoveryPayload({
      objects: [
        {
          objectKey: 'ledger',
          objectName: 'Ledger',
          fields: [{ name: 'NAME' }, { name: 'GSTIN' }],
        },
      ],
    });
    assert.equal(n.objects.length, 1);
    assert.equal(n.thin, false);
    assert.equal(n.objects[0].fields.length, 2);
  });
});

describe('ATIP aiMappingEngine', () => {
  it('maps NAME → name with high confidence', () => {
    assert.ok(scorePair('NAME', 'name') > 0.9);
    assert.ok(scorePair('GSTIN', 'gstin') > 0.9);
  });

  it('suggestAll returns rules for schema', async () => {
    const suggestions = await suggestAll({
      organizationId: 'x',
      companyGuid: 'g',
      schemas: [
        {
          tallyObjectKey: 'ledger',
          arivuEntityType: 'party',
          fields: [{ name: 'NAME' }, { name: 'GSTIN' }, { name: 'EMAIL' }],
        },
      ],
    });
    assert.equal(suggestions.length, 3);
    assert.equal(suggestions.find((s) => s.tallyField === 'NAME').arivuField, 'name');
  });
});

describe('ATIP validationEngine', () => {
  it('rejects invalid GSTIN', () => {
    assert.ok(validateGstin('ABC'));
    assert.equal(validateGstin('27AABCU9603R1ZM'), null);
  });

  it('detects unbalanced voucher', () => {
    const issues = validateVoucherBalance({
      ledgerEntries: [
        { amount: 100, isDebit: true },
        { amount: 90, isDebit: false },
      ],
    });
    assert.equal(issues[0].code, 'VOUCHER_UNBALANCED');
  });

  it('validatePayload aggregates', () => {
    const r = validatePayload({
      entityType: 'party',
      payload: { name: 'Acme', gstin: 'bad' },
      requiredFields: ['name'],
    });
    assert.equal(r.ok, false);
  });
});

describe('ATIP transformationEngine', () => {
  it('date and yesno transforms', () => {
    assert.equal(toTallyDate('2024-01-15'), '20240115');
    assert.equal(fromTallyDate('20240115'), '2024-01-15');
    assert.equal(toTallyYesNo(true), 'Yes');
  });

  it('applyRules toTally', () => {
    const out = applyRules({
      source: { name: 'Acme', gstin: '27AABCU9603R1ZM' },
      rules: [
        { sourceField: 'NAME', targetField: 'name', transform: { type: 'direct' } },
        { sourceField: 'GSTIN', targetField: 'gstin', transform: { type: 'uppercase' } },
      ],
      direction: 'toTally',
    });
    assert.equal(out.NAME, 'Acme');
    assert.equal(out.GSTIN, '27AABCU9603R1ZM');
  });
});

describe('ATIP errorIntelligenceEngine', () => {
  it('maps duplicate ledger', () => {
    const e = enrichError('Ledger already exists in Tally');
    assert.equal(e.problemCode, 'DUPLICATE_LEDGER');
    assert.equal(e.resolutionCode, 'USE_UPDATE');
  });
});
