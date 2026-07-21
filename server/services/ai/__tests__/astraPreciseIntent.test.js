'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const {
  validateIntent,
  validatePlan,
  mergeFilterOverlay,
  filterTreeToIntentFilters,
} = require('../astra/contracts/intentPlanSchemas');
const {
  buildPreciseIntent,
  buildPrecisePlan,
  applyOverlayToQueryPlan,
  buildDeterministicFilterOverlay,
} = require('../astra/planner/preciseIntentPlanner');
const { isMvpPipelineIntent } = require('../astra/intent/intentAnalyzer');
const { getPrompt } = require('../prompts/promptRegistry');

const goldenPath = path.join(__dirname, '../astra/eval/goldenIntentPlan.v1.json');
const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));

function hasAmountGte(filters, min) {
  return (filters || []).some(
    (f) => f.fieldKey === 'amount'
      && ['gte', 'gt'].includes(f.operator)
      && Number(f.value) >= min,
  );
}

function hasStatus(filters, value) {
  return (filters || []).some(
    (f) => f.fieldKey === 'status'
      && (f.operator === 'is' ? f.value === value : Array.isArray(f.value) && f.value.includes(value)),
  );
}

describe('Intent/Plan schemas', () => {
  it('validateIntent accepts CrmDataList with is_any_of', () => {
    const { ok, intent, errors } = validateIntent({
      intent: 'CrmDataList',
      moduleKey: 'deals',
      filters: [
        { fieldKey: 'status', operator: 'is', value: 'Won' },
        { fieldKey: 'stage', operator: 'is_any_of', value: ['Closed Won', 'Won'] },
      ],
      confidence: 0.95,
    });
    assert.equal(ok, true, errors.join('; '));
    assert.equal(intent.filters.length, 2);
  });

  it('validatePlan rejects unknown tools', () => {
    const { ok } = validatePlan({
      steps: [{ id: 'x', tool: 'DropAllTables', input: {} }],
    });
    assert.equal(ok, false);
  });

  it('mergeFilterOverlay lets overlay win on status', () => {
    const merged = mergeFilterOverlay(
      [{ fieldKey: 'status', operator: 'is', value: 'Open', confidence: 0.5 }],
      [{ fieldKey: 'status', operator: 'is', value: 'Won', confidence: 0.99 }],
    );
    assert.equal(merged.length, 1);
    assert.equal(merged[0].value, 'Won');
  });

  it('filterTreeToIntentFilters flattens won OR group', () => {
    const filters = filterTreeToIntentFilters({
      logic: 'AND',
      children: [{
        logic: 'OR',
        children: [
          { fieldKey: 'status', operator: 'is', value: 'Won' },
          { fieldKey: 'stage', operator: 'is_any_of', value: ['Closed Won', 'Won'] },
        ],
      }],
    });
    assert.ok(filters.some((f) => f.fieldKey === 'status' && f.value === 'Won'));
    assert.ok(filters.some((f) => f.fieldKey === 'stage' && f.operator === 'is_any_of'));
  });
});

describe('Prompts v2 registered', () => {
  it('astra_intent_v2 and astra_planner_v2 exist', () => {
    assert.match(getPrompt('astra_intent_v2').text, /Won deals/);
    assert.match(getPrompt('astra_planner_v2').text, /is_any_of/);
    assert.equal(getPrompt('astra_intent_v2').version, 'v2');
    assert.equal(getPrompt('astra_planner_v2').version, 'v3');
    assert.match(getPrompt('astra_planner_v2').text, /Sample Deal/);
    assert.match(getPrompt('astra_crm_answer_v1').text, /preview rows/i);
  });
});

describe('Golden intent/plan v1 (deterministic, no LLM)', () => {
  for (const caseItem of golden) {
    it(caseItem.id, () => {
      const q = caseItem.question;
      const exp = caseItem.expect || {};
      const memory = caseItem.memory || {};

      if (exp.overlayPlan) {
        const plan = applyOverlayToQueryPlan(null, q);
        assert.ok(plan, 'overlay should produce a plan');
        if (exp.isWon) {
          assert.equal(plan.headlineHint, exp.headlineHint || 'Won deals');
          assert.equal(plan.wantList, true);
        }
        if (exp.isLost) {
          assert.equal(plan.headlineHint, exp.headlineHint || 'Lost deals');
          assert.equal(plan.wantList, true);
        }
        if (exp.wantList) assert.equal(plan.wantList, true);
        if (exp.statusValue) {
          assert.ok(hasStatus(plan.filters, exp.statusValue), `expected status ${exp.statusValue}`);
        }
        if (exp.amountGte != null) {
          assert.ok(hasAmountGte(plan.filters, exp.amountGte), `expected amount >= ${exp.amountGte}`);
        }
        return;
      }

      const precise = buildPreciseIntent({ question: q, memory });
      assert.equal(precise.ok, true, (precise.errors || []).join('; '));
      const intent = precise.intent;
      assert.ok(intent);

      if (exp.intent) assert.equal(intent.intent, exp.intent);
      if (exp.moduleKey) assert.equal(intent.moduleKey, exp.moduleKey);
      if (exp.deferToLegacy) assert.equal(intent.deferToLegacy, true);
      if (exp.needsClarification === true) assert.equal(intent.needs_clarification, true);
      if (exp.needsClarification === false) assert.equal(intent.needs_clarification, false);
      if (exp.accountHint) assert.match(String(intent.accountHint), new RegExp(exp.accountHint, 'i'));
      if (exp.isWon) assert.equal(precise.overlay.isWon, true);
      if (exp.isLost) assert.equal(precise.overlay.isLost, true);
      if (exp.isWon === false) assert.equal(precise.overlay.isWon, false);
      if (exp.statusValue) {
        assert.ok(
          hasStatus(intent.filters, exp.statusValue)
            || hasStatus(precise.overlay.filters, exp.statusValue),
          `expected status ${exp.statusValue}`,
        );
      }
      if (Array.isArray(exp.filterFields)) {
        const fields = new Set([
          ...(intent.filters || []).map((f) => f.fieldKey),
          ...(precise.overlay.filters || []).map((f) => f.fieldKey),
        ]);
        for (const f of exp.filterFields) {
          assert.ok(fields.has(f), `missing filter field ${f}`);
        }
      }
      if (exp.amountGte != null) {
        assert.ok(
          hasAmountGte(intent.filters, exp.amountGte)
            || hasAmountGte(precise.overlay.filters, exp.amountGte),
          `expected amount >= ${exp.amountGte}`,
        );
      }
      if (exp.pipeline) {
        assert.ok(isMvpPipelineIntent({
          intent: intent.intent,
          deferToLegacy: intent.deferToLegacy,
        }) || intent.needs_clarification);
        const planned = buildPrecisePlan({ intent, question: q, memory });
        assert.ok(planned.ok || planned.plan?.clarifyOnly, (planned.errors || []).join('; '));
      }
    });
  }
});

describe('buildDeterministicFilterOverlay', () => {
  it('won overlay includes status + stage', () => {
    const overlay = buildDeterministicFilterOverlay('Won deals', 'deals');
    assert.equal(overlay.isWon, true);
    assert.ok(overlay.filters.some((f) => f.fieldKey === 'status'));
    assert.ok(overlay.filters.some((f) => f.fieldKey === 'stage'));
  });
});
