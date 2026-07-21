'use strict';

/**
 * CI gate: Won / amount asks must fail verify when preview rows violate filters.
 * (Deterministic — no LLM, no DB.)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  buildPreciseIntent,
  applyOverlayToQueryPlan,
} = require('../astra/planner/preciseIntentPlanner');
const {
  verifyCrmPreviewAgainstAsk,
} = require('../astra/planner/verifyAndReplan');
const {
  isWonDealAsk,
  detectFilters,
} = require('../aiAstraReportBuilderService');

const goldenPath = path.join(__dirname, '../astra/eval/goldenIntentPlan.v1.json');
const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));

function hasAmountGte(filters, min) {
  return (filters || []).some(
    (f) => f.fieldKey === 'amount'
      && ['gte', 'gt'].includes(f.operator)
      && Number(f.value) >= min,
  );
}

describe('Golden preview invariants (Won / amount)', () => {
  const wonCases = golden.filter((c) => c.expect?.isWon === true && !c.expect?.overlayPlan);
  const amountCases = golden.filter((c) => c.expect?.amountGte != null && !c.expect?.overlayPlan);

  it(`covers ${wonCases.length} won + ${amountCases.length} amount golden cases`, () => {
    assert.ok(wonCases.length >= 4);
    assert.ok(amountCases.length >= 3);
  });

  for (const caseItem of wonCases) {
    it(`won invariant: ${caseItem.id}`, () => {
      const q = caseItem.question;
      assert.equal(isWonDealAsk(q), true);
      const precise = buildPreciseIntent({ question: q });
      assert.equal(precise.overlay.isWon, true);
      assert.ok(
        precise.overlay.filters.some((f) => f.fieldKey === 'status' || f.fieldKey === 'stage'),
        'won overlay must include status/stage',
      );

      const bad = verifyCrmPreviewAgainstAsk({
        question: q,
        plan: applyOverlayToQueryPlan(null, q),
        preview: {
          result: {
            rows: [
              { name: 'Bad', stage: 'Negotiation', status: 'Open', amount: 90000 },
              { name: 'Good', stage: 'Closed Won', status: 'Won', amount: 12000 },
            ],
          },
        },
      });
      assert.equal(bad.ok, false);
      assert.ok(bad.failures.some((f) => f.code === 'WON_ROWS_MISMATCH'));

      const good = verifyCrmPreviewAgainstAsk({
        question: q,
        plan: applyOverlayToQueryPlan(null, q),
        preview: {
          result: {
            rows: [{ name: 'Good', stage: 'Closed Won', status: 'Won', amount: 12000 }],
          },
        },
      });
      assert.equal(good.ok, true);
    });
  }

  for (const caseItem of amountCases) {
    it(`amount invariant: ${caseItem.id}`, () => {
      const q = caseItem.question;
      const min = caseItem.expect.amountGte;
      const precise = buildPreciseIntent({ question: q });
      assert.ok(
        hasAmountGte(precise.overlay.filters, min)
          || hasAmountGte(precise.intent?.filters, min),
        `expected amount >= ${min}`,
      );

      const { filterTree } = detectFilters(q, 'deals');
      assert.ok(
        (filterTree.children || []).some(
          (c) => c.fieldKey === 'amount' && Number(c.value) >= min,
        ),
        'detectFilters must emit amount threshold',
      );

      const bad = verifyCrmPreviewAgainstAsk({
        question: q,
        plan: applyOverlayToQueryPlan(null, q),
        preview: {
          result: {
            rows: [
              { name: 'Cheap', amount: Math.max(1, min - 1), stage: 'New', status: 'Open' },
              { name: 'Ok', amount: min + 1000, stage: 'New', status: 'Open' },
            ],
          },
        },
      });
      assert.equal(bad.ok, false);
      assert.ok(bad.failures.some((f) => f.code === 'AMOUNT_ROWS_MISMATCH'));
    });
  }
});
