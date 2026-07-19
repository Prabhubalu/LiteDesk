'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  inferModuleAndGroup,
  resolveChartType,
} = require('../pinAstraVisualToDashboard');

describe('pinAstraVisualToDashboard helpers', () => {
  it('uses pinSource when present', () => {
    const inferred = inferModuleAndGroup({
      component: 'chart',
      title: 'Anything',
      pinSource: { moduleKey: 'tasks', groupField: 'status', metric: 'count' },
    });
    assert.deepEqual(inferred, {
      moduleKey: 'tasks',
      groupField: 'status',
      metric: 'count',
    });
  });

  it('infers tasks pie from title', () => {
    const inferred = inferModuleAndGroup({
      component: 'chart',
      title: 'tasks by status',
    });
    assert.equal(inferred?.moduleKey, 'tasks');
    assert.equal(inferred?.groupField, 'status');
  });

  it('maps visual components to chart types', () => {
    assert.equal(resolveChartType({ component: 'chart', chartType: 'pie' }), 'pie');
    assert.equal(resolveChartType({ component: 'data_table' }), 'table');
    assert.equal(resolveChartType({ component: 'progress_list' }), 'bar');
    assert.equal(resolveChartType({ component: 'kpi_strip' }), 'kpi');
  });
});
