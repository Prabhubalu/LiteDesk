const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeGroupFields,
  normalizeAggregations,
  normalizeSelectedFields,
} = require('../analyticsEngine');
const { buildCacheKey } = require('../analyticsCacheService');
const { resultToCsv, escapeCsvCell } = require('../analyticsExportService');

describe('analyticsEngine normalizers', () => {
  it('normalizeGroupFields accepts strings and objects', () => {
    assert.deepEqual(normalizeGroupFields(['stage', { field: 'pipeline' }]), [
      'stage',
      'pipeline',
    ]);
  });

  it('normalizeAggregations maps fn and label', () => {
    const aggs = normalizeAggregations([
      { field: 'amount', fn: 'sum', label: 'Total Amount' },
      { field: '_id', aggregation: 'count' },
    ]);
    assert.equal(aggs[0].label, 'Total Amount');
    assert.equal(aggs[0].fn, 'sum');
    assert.equal(aggs[1].fn, 'count');
  });

  it('normalizeSelectedFields preserves role and label', () => {
    const fields = normalizeSelectedFields([
      'stage',
      { field: 'amount', role: 'metric', label: 'Deal Value' },
    ]);
    assert.equal(fields[0].field, 'stage');
    assert.equal(fields[1].role, 'metric');
    assert.equal(fields[1].label, 'Deal Value');
  });
});

describe('analyticsModuleRegistry', () => {
  it('lists MVP modules including cases', () => {
    const { listAnalyticsModules } = require('../analyticsModuleRegistry');
    const keys = listAnalyticsModules().map((m) => m.moduleKey);
    assert.ok(keys.includes('deals'));
    assert.ok(keys.includes('people'));
    assert.ok(keys.includes('cases'));
  });
});

describe('analyticsCacheService', () => {
  it('buildCacheKey is stable and includes report id', () => {
    const params = {
      organizationId: 'org1',
      reportId: 'rep1',
      reportVersion: 2,
      userId: 'user1',
      runtimeFilters: { logic: 'AND', children: [] },
    };
    const key1 = buildCacheKey(params);
    const key2 = buildCacheKey(params);
    assert.equal(key1, key2);
    assert.ok(key1.includes('org1:rep1:2:'));
  });
});

describe('analyticsExportService', () => {
  it('escapeCsvCell quotes values with commas', () => {
    assert.equal(escapeCsvCell('hello, world'), '"hello, world"');
  });

  it('resultToCsv renders header and rows', () => {
    const csv = resultToCsv({
      columns: [
        { key: 'stage', label: 'Stage' },
        { key: 'total', label: 'Total' },
      ],
      rows: [{ stage: 'Proposal', total: 100 }],
    });
    assert.ok(csv.includes('Stage,Total'));
    assert.ok(csv.includes('Proposal,100'));
  });
});
