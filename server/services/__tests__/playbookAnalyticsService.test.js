'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizePlaybookAnalytics } = require('../playbookAnalyticsService');

test('summarizePlaybookAnalytics aggregates action and stage metrics', () => {
  const pastDue = new Date(Date.now() - 60 * 60 * 1000);
  const summary = summarizePlaybookAnalytics([
    {
      pipeline: 'default',
      playbookState: {
        stageKey: 'qualification',
        stageName: 'Qualification',
        exitCriteriaMet: false,
        actions: [
          { actionKey: 'a', status: 'completed', required: true },
          { actionKey: 'b', status: 'pending', dueAt: pastDue, required: true }
        ]
      }
    },
    {
      pipeline: 'default',
      playbookState: {
        stageKey: 'qualification',
        stageName: 'Qualification',
        exitCriteriaMet: true,
        actions: [
          { actionKey: 'c', status: 'completed', required: true },
          { actionKey: 'd', status: 'blocked', required: false }
        ]
      }
    }
  ]);

  assert.equal(summary.activeDeals, 2);
  assert.equal(summary.totalActions, 4);
  assert.equal(summary.completedActions, 2);
  assert.equal(summary.pendingActions, 1);
  assert.equal(summary.blockedActions, 1);
  assert.equal(summary.overdueActions, 1);
  assert.equal(summary.exitCriteriaMetDeals, 1);
  assert.equal(summary.completionRate, 50);
  assert.equal(summary.byStage.length, 1);
  assert.equal(summary.byStage[0].deals, 2);
  assert.equal(summary.byStage[0].overdueActions, 1);
});
