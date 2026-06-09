'use strict';

const Deal = require('../models/Deal');

function summarizePlaybookAnalytics(deals = []) {
  const now = Date.now();
  const summary = {
    activeDeals: 0,
    totalActions: 0,
    completedActions: 0,
    pendingActions: 0,
    blockedActions: 0,
    overdueActions: 0,
    exitCriteriaMetDeals: 0,
    completionRate: 0,
    byStage: []
  };

  const byStageMap = new Map();

  for (const deal of deals) {
    const actions = Array.isArray(deal?.playbookState?.actions) ? deal.playbookState.actions : [];
    if (!actions.length) continue;

    summary.activeDeals += 1;
    if (deal.playbookState.exitCriteriaMet === true) {
      summary.exitCriteriaMetDeals += 1;
    }

    const stageKey = String(deal.playbookState?.stageKey || 'unknown');
    if (!byStageMap.has(stageKey)) {
      byStageMap.set(stageKey, {
        stageKey,
        stageName: deal.playbookState?.stageName || stageKey,
        deals: 0,
        totalActions: 0,
        completedActions: 0,
        pendingActions: 0,
        blockedActions: 0,
        overdueActions: 0,
        exitCriteriaMetDeals: 0
      });
    }
    const stageRow = byStageMap.get(stageKey);
    stageRow.deals += 1;
    if (deal.playbookState.exitCriteriaMet === true) {
      stageRow.exitCriteriaMetDeals += 1;
    }

    for (const action of actions) {
      summary.totalActions += 1;
      stageRow.totalActions += 1;

      if (action.status === 'completed') {
        summary.completedActions += 1;
        stageRow.completedActions += 1;
        continue;
      }

      if (action.status === 'blocked') {
        summary.blockedActions += 1;
        stageRow.blockedActions += 1;
        continue;
      }

      summary.pendingActions += 1;
      stageRow.pendingActions += 1;

      const dueAt = action.dueAt ? new Date(action.dueAt).getTime() : null;
      if (dueAt && dueAt < now) {
        summary.overdueActions += 1;
        stageRow.overdueActions += 1;
      }
    }
  }

  summary.completionRate = summary.totalActions
    ? Math.round((summary.completedActions / summary.totalActions) * 100)
    : 0;

  summary.byStage = Array.from(byStageMap.values()).sort((left, right) => {
    return String(left.stageName).localeCompare(String(right.stageName));
  });

  return summary;
}

async function getPlaybookAnalytics(organizationId, options = {}) {
  const match = {
    organizationId,
    deletedAt: null,
    'playbookState.actions.0': { $exists: true }
  };

  const pipelineKey = String(options.pipelineKey || options.pipeline || '').trim();
  if (pipelineKey) {
    match.pipeline = pipelineKey;
  }

  const deals = await Deal.find(match)
    .select('playbookState pipeline stage')
    .lean();

  return summarizePlaybookAnalytics(deals);
}

module.exports = {
  summarizePlaybookAnalytics,
  getPlaybookAnalytics
};
