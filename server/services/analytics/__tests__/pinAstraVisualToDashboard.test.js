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
    assert.equal(inferred.moduleKey, 'tasks');
    assert.equal(inferred.groupField, 'status');
    assert.equal(inferred.metric, 'count');
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

  it('treats deal list tables as tabular pins, not stage summaries', () => {
    const {
      looksLikeRecordListTable,
      wantsTabularPin,
    } = require('../pinAstraVisualToDashboard');
    const visual = {
      component: 'data_table',
      title: 'Deals Over $10K',
      columns: ['DEAL', 'AMOUNT', 'STAGE'],
      rows: [['Acme', '12000', 'Proposal']],
    };
    assert.equal(looksLikeRecordListTable(visual), true);
    const inferred = inferModuleAndGroup(visual);
    assert.equal(inferred?.moduleKey, 'deals');
    assert.equal(wantsTabularPin(visual, inferred), true);
  });

  it('pins record-level pie as deals-by-name, not by stage', () => {
    const {
      wantsTabularPin,
      wantsRecordLevelChartPin,
      buildRecordLevelChartPreset,
      recordLabelField,
    } = require('../pinAstraVisualToDashboard');

    const visual = {
      component: 'chart',
      chartType: 'pie',
      title: 'Deals ≥ $50K',
      pinSource: {
        moduleKey: 'deals',
        groupField: '',
        metric: 'amount',
        reportType: 'tabular',
        recordLevel: true,
        question: 'list of deals above 50K and a pie chart',
      },
    };
    const inferred = inferModuleAndGroup(visual);
    assert.equal(inferred.groupField, '');
    assert.equal(inferred.recordLevel, true);
    assert.equal(wantsTabularPin(visual, inferred), false);
    assert.equal(wantsRecordLevelChartPin(visual, inferred), true);
    assert.equal(recordLabelField('deals'), 'name');

    const preset = buildRecordLevelChartPreset({
      moduleKey: 'deals',
      metric: 'amount',
      name: 'Deals ≥ $50K (Astra)',
      question: visual.pinSource.question,
    });
    assert.equal(preset.type, 'summary');
    assert.equal(preset.rowGroups[0].field, 'name');
    assert.ok(preset.filterTree?.children?.some((c) => c.fieldKey === 'amount'));
  });
});
