'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { resolveFieldValues, resolveExpression } = require('../processFieldValueResolver');
const { evaluateFormula } = require('../processFormulaEvaluator');
const { FORMULA_HELPER_CATALOG, HELPERS } = require('../processFormulaHelpers');

describe('processFieldValueResolver + formula library', () => {
  const ctx = {
    entityId: 'p1',
    entityType: 'people',
    event: {
      entityId: 'p1',
      currentState: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com', amount: 10.5 }
    },
    dataBag: { ticketPrefix: 'T-' }
  };

  it('resolves legacy raw strings', () => {
    assert.equal(resolveFieldValues({ title: 'Hello' }, ctx).title, 'Hello');
  });

  it('copies from trigger fields', () => {
    const out = resolveFieldValues(
      { title: { mode: 'copy', source: 'first_name' } },
      ctx
    );
    assert.equal(out.title, 'Ada');
  });

  it('evaluates formula helpers', () => {
    const out = resolveFieldValues(
      {
        title: {
          mode: 'expression',
          expression: 'concat("Follow up: ", uppercase(trigger.first_name), " ", trigger.last_name)'
        }
      },
      ctx
    );
    assert.equal(out.title, 'Follow up: ADA Lovelace');
  });

  it('supports mergetag pipes still', () => {
    const out = resolveFieldValues(
      {
        title: {
          mode: 'expression',
          expression: 'Hi {{trigger.first_name|uppercase}}'
        }
      },
      ctx
    );
    assert.equal(out.title, 'Hi ADA');
  });

  it('if / coalesce / trim', () => {
    const scope = require('../processFieldValueResolver').buildScope(ctx);
    assert.equal(evaluateFormula('if(is_empty(""), "x", "y")', scope), 'x');
    assert.equal(evaluateFormula('coalesce("", trigger.first_name)', scope), 'Ada');
    assert.equal(evaluateFormula('trim("  a  ")', scope), 'a');
  });

  it('math helpers', () => {
    assert.equal(HELPERS.roundoff(10.456, 2), 10.46);
    assert.equal(HELPERS.abs(-3), 3);
    assert.equal(HELPERS.min(3, 1, 2), 1);
  });

  it('catalog covers all documented helpers', () => {
    assert.ok(FORMULA_HELPER_CATALOG.length >= 66);
    assert.ok(FORMULA_HELPER_CATALOG.some((h) => h.name === 'concat'));
    assert.ok(FORMULA_HELPER_CATALOG.some((h) => h.name === 'if'));
    assert.ok(typeof HELPERS.uppercase === 'function');
  });

  it('date constants resolve', () => {
    const scope = require('../processFieldValueResolver').buildScope(ctx);
    const today = evaluateFormula('today', scope);
    assert.match(String(today), /^\d{4}-\d{2}-\d{2}$/);
  });
});
