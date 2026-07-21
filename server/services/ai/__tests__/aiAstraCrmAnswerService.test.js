'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('aiAstraCrmAnswerService', () => {
  it('compacts preview rows to allowlisted fields', () => {
    const { compactPreviewRows } = require('../aiAstraCrmAnswerService');
    const rows = compactPreviewRows({
      result: {
        rows: [{
          _id: '507f1f77bcf86cd799439011',
          name: 'Sample Deal',
          amount: 999,
          stage: 'Negotiation',
          status: 'Won',
          secretInternal: 'should-drop',
          assignedTo: { name: 'Arivu Admin' },
          startDateTime: 'Wed Jul 22 2026 21:42:20 GMT+0530 (India Standard Time)',
        }],
      },
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'Sample Deal');
    assert.equal(rows[0].amount, 999);
    assert.equal(rows[0].assignedTo, 'Arivu Admin');
    assert.equal(rows[0].secretInternal, undefined);
    assert.match(String(rows[0].startDateTime), /^2026-07-22 /);
  });

  it('replaces meta nextAction rationales like concrete example', () => {
    const {
      looksMetaActionRationale,
      sanitizeNextActionRationale,
    } = require('../aiAstraCrmAnswerService');
    assert.equal(
      looksMetaActionRationale('Provides a concrete example for immediate follow-up'),
      true,
    );
    const cleaned = sanitizeNextActionRationale(
      'Provides a concrete example for immediate follow-up',
      {
        moduleKey: 'tasks',
        preview: {
          rows: [{
            _id: '507f1f77bcf86cd799439011',
            title: 'Research account background',
            status: 'Todo',
            priority: 'medium',
            dueDate: '2026-06-30',
          }],
        },
        recordId: '507f1f77bcf86cd799439011',
      },
    );
    assert.equal(/\bexample\b/i.test(cleaned), false);
    assert.match(cleaned, /Research account background|Todo|medium|due/i);
  });

  it('drops abruptly truncated bullets like "Start dates range from 2"', () => {
    const { looksAbruptlyTruncated, sanitizeSynthBullets } = require('../aiAstraCrmAnswerService');
    assert.equal(looksAbruptlyTruncated('Start dates range from 2'), true);
    assert.equal(looksAbruptlyTruncated('All events are currently Planned'), false);
    const cleaned = sanitizeSynthBullets([
      'All events are currently Planned',
      'Start dates range from 2',
      'Assigned to Arivu Admin',
    ]);
    assert.deepEqual(cleaned, [
      'All events are currently Planned',
      'Assigned to Arivu Admin',
    ]);
  });

  it('resolves nextAction to a preview deal id, never a report id', () => {
    const { resolveNextActionRecordId } = require('../aiAstraCrmAnswerService');
    const dealA = '507f1f77bcf86cd799439011';
    const dealB = '507f1f77bcf86cd799439022';
    const reportId = '6a5ee98249a7369287eada3c';
    const preview = {
      rows: [
        { _id: dealA, name: 'Small Deal', amount: 100, stage: 'New' },
        { _id: dealB, name: 'ReportsE2E Deal BIG', amount: 50000, stage: 'Qualification' },
      ],
    };
    const fromClaim = resolveNextActionRecordId(
      { label: 'Review', recordId: dealA, moduleKey: 'deals' },
      preview,
      'deals',
    );
    assert.equal(fromClaim.recordId, dealA);

    const rejectReport = resolveNextActionRecordId(
      { label: 'Review high-value Qualification deal', recordId: reportId, moduleKey: 'deals' },
      preview,
      'deals',
    );
    assert.equal(rejectReport.recordId, dealB);

    const byStage = resolveNextActionRecordId(
      { label: 'Review high-value Qualification deal', rationale: 'largest amount', moduleKey: 'deals' },
      preview,
      'deals',
    );
    assert.equal(byStage.recordId, dealB);
  });

  it('builds grounded user payload with row JSON', () => {
    const { buildGroundedUserPayload } = require('../aiAstraCrmAnswerService');
    const text = buildGroundedUserPayload({
      question: "Summarize deal 'Sample Deal'",
      understanding: 'Retrieve Sample Deal for summary',
      moduleKey: 'deals',
      rowCount: 1,
      rows: [{ name: 'Sample Deal', amount: 999, stage: 'Negotiation' }],
    });
    assert.match(text, /Sample Deal/);
    assert.match(text, /Negotiation/);
    assert.match(text, /Row count: 1/);
  });

  it('applyCrmGroundedSynthesis merges LLM prose and prefers nextAction over NBA', async () => {
    const Module = require('module');
    const originalLoad = Module._load;
    Module._load = function mockLoad(request, parent, isMain) {
      if (request === './providerRegistry') {
        return {
          getLlmAdapter: () => ({
            complete: async () => ({
              text: JSON.stringify({
                headline: 'Sample Deal summary',
                bullets: [
                  'Stage Negotiation · amount 999',
                  'Risk: status Won while still in Negotiation',
                ],
                detail: 'Confirm whether this deal is truly closed or stage is stale.',
                nextAction: {
                  label: 'Reconcile Won status vs Negotiation stage',
                  rationale: 'Data inconsistency blocks a clean close plan',
                  recordId: '507f1f77bcf86cd799439011',
                  moduleKey: 'deals',
                },
              }),
              usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            }),
          }),
        };
      }
      if (request === './piiRedaction') {
        return { redactMessages: (m) => m };
      }
      if (request === './aiMarketingService') {
        return {
          parseJsonObject: (text) => JSON.parse(String(text || '{}')),
        };
      }
      if (request === './prompts/promptRegistry') {
        return {
          getPrompt: () => ({ version: 'v1', text: 'Return JSON only.' }),
        };
      }
      return originalLoad(request, parent, isMain);
    };

    try {
      delete require.cache[require.resolve('../aiAstraCrmAnswerService')];
      const { applyCrmGroundedSynthesis } = require('../aiAstraCrmAnswerService');
      const structured = {
        headline: 'Sample Deal',
        bullets: ['1 record matched'],
        detail: '',
        actions: [{
          label: 'Pin to dashboard',
          kind: 'pin_report_to_dashboard',
          recordId: 'rep1',
        }],
        visuals: [{ component: 'data_table' }],
      };
      const result = await applyCrmGroundedSynthesis(structured, {
        question: "Summarize deal 'Sample Deal', risks, and next action",
        plan: { moduleKey: 'deals', understanding: 'summarize' },
        preview: {
          rows: [{
            _id: '507f1f77bcf86cd799439011',
            name: 'Sample Deal',
            amount: 999,
            stage: 'Negotiation',
            status: 'Won',
          }],
        },
        moduleKey: 'deals',
        config: { apiKey: 'k', provider: 'openai', model: 'gpt-test' },
      });
      assert.equal(result.crmSynthesis, true);
      assert.equal(result.hasLlmNextAction, true);
      assert.equal(result.structured.headline, 'Sample Deal summary');
      assert.ok(result.structured.bullets.some((b) => /999|Negotiation/i.test(b)));
      assert.equal(result.structured.actions[0].kind, 'review_record');
      assert.match(result.structured.actions[0].label, /Reconcile/);
      assert.equal(result.structured.actions.some((a) => a.kind === 'pin_report_to_dashboard'), true);
      assert.equal(result.usage.totalTokens, 30);
    } finally {
      Module._load = originalLoad;
      delete require.cache[require.resolve('../aiAstraCrmAnswerService')];
    }
  });
});

describe('LLM-first QueryPlan overlays', () => {
  it('named-record fallback only adds contains when missing', () => {
    const {
      applyNamedRecordPlanFallback,
      isValidLlmQueryPlan,
      validateQueryPlan,
    } = require('../aiAstraReportBuilderService');

    const q = "Summarize deal 'Sample Deal', risks, and the single best next action";
    const llmPlan = validateQueryPlan({
      understanding: 'Retrieve Sample Deal for summary',
      moduleKey: 'deals',
      wantList: true,
      wantChart: false,
      chartType: 'none',
      filters: [{ fieldKey: 'name', operator: 'contains', value: 'Sample Deal' }],
      headlineHint: 'Sample Deal',
    });
    assert.equal(isValidLlmQueryPlan(llmPlan), true);
    const kept = applyNamedRecordPlanFallback(llmPlan, q);
    assert.equal(kept.filters.length, 1);
    assert.equal(kept.filters[0].value, 'Sample Deal');

    const missing = applyNamedRecordPlanFallback({
      moduleKey: 'deals',
      wantList: true,
      filters: [{ fieldKey: 'amount', operator: 'gte', value: 1 }],
    }, q);
    assert.ok(missing.filters.some((f) => f.operator === 'contains' && f.value === 'Sample Deal'));
  });

  it('heuristic overlays still apply when LLM plan is invalid', () => {
    const {
      applyHeuristicPlanOverlays,
      isWonDealAsk,
    } = require('../aiAstraReportBuilderService');
    const q = 'Give me the listy of Won deals';
    assert.equal(isWonDealAsk(q), true);
    const plan = applyHeuristicPlanOverlays(null, q);
    assert.equal(plan.moduleKey, 'deals');
    assert.equal(plan.wantList, true);
    assert.equal(plan.headlineHint, 'Won deals');
  });

  it('planner prompt covers named summarize few-shot', () => {
    const { getPrompt } = require('../prompts/promptRegistry');
    const p = getPrompt('astra_planner_v2');
    assert.equal(p.version, 'v3');
    assert.match(p.text, /name","operator":"contains"/);
    assert.match(getPrompt('astra_crm_answer_v1').text, /Never invent/);
  });
});
