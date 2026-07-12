'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  FORMULA_HELPER_CATALOG,
  HELPERS,
  callHelper
} = require('../processFormulaHelpers');
const { evaluateFormula } = require('../processFormulaEvaluator');
const { resolveFieldValues, buildScope } = require('../processFieldValueResolver');

const BAD_ARGS = [undefined, null, '', 'not-a-date', {}, [], NaN, Infinity, -Infinity, true, false];

describe('formula helpers customer-safety', () => {
  it('every catalog helper has an implementation', () => {
    for (const h of FORMULA_HELPER_CATALOG) {
      assert.equal(typeof HELPERS[h.name], 'function', `missing: ${h.name}`);
    }
  });

  it('helpers never throw on nullish / garbage args', () => {
    for (const h of FORMULA_HELPER_CATALOG) {
      for (const a of BAD_ARGS) {
        assert.doesNotThrow(() => callHelper(h.name, [a]), `${h.name}([${String(a)}])`);
        assert.doesNotThrow(() => callHelper(h.name, [a, a]), `${h.name}([a,a])`);
        assert.doesNotThrow(() => callHelper(h.name, [a, a, a]), `${h.name}([a,a,a])`);
        assert.doesNotThrow(() => callHelper(h.name, []), `${h.name}([])`);
      }
    }
  });

  it('math helpers never return NaN/Infinity', () => {
    const mathNames = FORMULA_HELPER_CATALOG.filter((h) => h.category === 'math').map((h) => h.name);
    for (const name of mathNames) {
      for (const a of BAD_ARGS) {
        const v = callHelper(name, [a, a]);
        if (typeof v === 'number') {
          assert.equal(Number.isFinite(v), true, `${name} returned non-finite ${v}`);
        }
      }
    }
  });

  it('weekday helpers survive invalid dates (no crash)', () => {
    assert.equal(callHelper('time_diffweekdays', [null]), null);
    assert.equal(callHelper('time_diffweekdays', ['bad', 'also-bad']), null);
    assert.equal(callHelper('time_diffdays', [null, null]), null);
    assert.equal(callHelper('add_weekdays', [null, 1000000]), null);
  });

  it('unknown helper fails closed without killing resolveFieldValues', () => {
    const ctx = {
      event: { currentState: { first_name: 'Ada' } },
      dataBag: {}
    };
    const out = resolveFieldValues(
      {
        ok: { mode: 'expression', expression: 'uppercase(trigger.first_name)' },
        bad: { mode: 'expression', expression: 'not_a_real_helper(1)' },
        prose: { mode: 'expression', expression: 'Hello Ada' }
      },
      ctx
    );
    assert.equal(out.ok, 'ADA');
    // unknown helper → formula throws → falls back to literal text
    assert.equal(out.bad, 'not_a_real_helper(1)');
    assert.equal(out.prose, 'Hello Ada');
  });

  it('nested helpers work', () => {
    const scope = buildScope({
      event: { currentState: { first_name: '  ada  ', email: '' } }
    });
    assert.equal(evaluateFormula('uppercase(trim(trigger.first_name))', scope), 'ADA');
    assert.equal(
      evaluateFormula('if(is_empty(trigger.email), "missing", trigger.email)', scope),
      'missing'
    );
  });

  it('replace with empty search does not explode', () => {
    assert.equal(callHelper('replace', ['hello', '', 'x']), 'hello');
  });
});
