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

  it('buildCacheKey differs when matrixDrill filters change', () => {
    const base = {
      organizationId: 'org1',
      reportId: 'rep1',
      reportVersion: 1,
      userId: 'user1',
      runtimeFilters: null,
    };
    const mainKey = buildCacheKey(base);
    const drillKey = buildCacheKey({
      ...base,
      matrixDrill: { rowFilters: { stage: 'Contract Sent' }, columnFilters: {} },
    });
    assert.notEqual(mainKey, drillKey);
  });
});

describe('analyticsMatrixPivot', () => {
  const { pivotMatrixResult, formatPivotCellKey, isMatrixReport } = require('../analyticsMatrixPivot');

  it('formatPivotCellKey handles blank values', () => {
    assert.equal(formatPivotCellKey(null), '(blank)');
    assert.equal(formatPivotCellKey('Open'), 'Open');
  });

  it('pivotMatrixResult builds cross-tab columns from flat rows', () => {
    const flatRows = [
      { stage: 'Open', owner: 'Alice', count: 5 },
      { stage: 'Open', owner: 'Bob', count: 3 },
      { stage: 'Closed', owner: 'Alice', count: 10 },
    ];

    const pivoted = pivotMatrixResult(flatRows, {
      rowFields: ['stage'],
      columnFields: ['owner'],
      metricKeys: ['count'],
      showGrandTotal: true,
    });

    assert.ok(pivoted);
    assert.equal(pivoted.rows.length, 2);
    assert.deepEqual(
      pivoted.columns.map((col) => col.key),
      ['stage', 'Alice', 'Bob', '_grandTotal'],
    );
    assert.equal(pivoted.rows[0].stage, 'Open');
    assert.equal(pivoted.rows[0].Alice, 5);
    assert.equal(pivoted.rows[0].Bob, 3);
    assert.equal(pivoted.rows[0]._grandTotal, 8);
    const aliceCol = pivoted.matrixLayout.pivotColumns.find((col) => col.label === 'Alice');
    assert.deepEqual(aliceCol?.filterValues, { owner: 'Alice' });
    assert.equal(pivoted.grandTotalRow.Alice, 15);
    assert.equal(pivoted.grandTotalRow.Bob, 3);
  });

  it('isMatrixReport detects column groups and matrix type', () => {
    assert.equal(isMatrixReport({ type: 'matrix', columnGroups: [] }), true);
    assert.equal(isMatrixReport({ type: 'summary', columnGroups: [{ field: 'owner' }] }), true);
    assert.equal(isMatrixReport({ type: 'summary', columnGroups: [] }), false);
  });

  it('buildMatrixDrillFilterAst maps blank values to is_empty', () => {
    const { buildMatrixDrillFilterAst } = require('../analyticsMatrixPivot');
    const ast = buildMatrixDrillFilterAst({
      rowFilters: { stage: 'Open' },
      columnFilters: { owner: null },
    });
    assert.equal(ast.children.length, 2);
    assert.equal(ast.children[0].fieldKey, 'stage');
    assert.equal(ast.children[1].operator, 'is_empty');
  });
});

describe('analyticsJoinPipeline', () => {
  const {
    partitionMatrixDrillFilters,
    buildPostJoinDrillMatchStage,
    resolvePhysicalField,
  } = require('../analyticsJoinPipeline');

  it('partitionMatrixDrillFilters splits primary and joined field keys', () => {
    const partitioned = partitionMatrixDrillFilters(
      {
        rowFilters: { stage: 'Open', 'people.email': 'a@example.com' },
        columnFilters: { 'people.email': 'a@example.com' },
      },
      'deals',
    );

    assert.deepEqual(partitioned.primaryRowFilters, { stage: 'Open' });
    assert.deepEqual(partitioned.joinedRowFilters, { 'people.email': 'a@example.com' });
    assert.deepEqual(partitioned.joinedColumnFilters, { 'people.email': 'a@example.com' });
  });

  it('buildPostJoinDrillMatchStage maps qualified joined fields to physical aliases', () => {
    const stage = buildPostJoinDrillMatchStage({ 'people.email': 'a@example.com' }, 'deals');
    assert.deepEqual(stage, {
      $match: { [resolvePhysicalField('deals', 'people.email')]: 'a@example.com' },
    });
  });

  it('resolveForeignIdExpr falls back to dealOrganizations for deals organizations join', () => {
    const { resolveForeignIdExpr } = require('../analyticsJoinPipeline');
    const join = {
      targetModule: 'organizations',
      localField: 'accountId',
    };
    const expr = resolveForeignIdExpr(join, 'deals');
    assert.equal(typeof expr, 'object');
    assert.ok(Array.isArray(expr.$ifNull));
    assert.equal(expr.$ifNull[0], '$accountId');
    assert.equal(expr.$ifNull[expr.$ifNull.length - 1], '$_analytics_join_people.organization');
  });

  it('buildJoinLookupScopeMatch omits tenant organizationId for CRM organizations', () => {
    const { buildJoinLookupScopeMatch } = require('../analyticsJoinPipeline');
    const tenantId = '507f1f77bcf86cd799439011';
    assert.deepEqual(buildJoinLookupScopeMatch('organizations', tenantId), {
      isTenant: { $ne: true },
    });
    assert.deepEqual(buildJoinLookupScopeMatch('people', tenantId), {
      organizationId: tenantId,
    });
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
