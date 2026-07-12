'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateProcessCondition,
  normalizeConditionGroup
} = require('../processConditionEvaluator');

describe('processConditionEvaluator two-block', () => {
  const ctx = {
    event: { currentState: { stage: 'Qualified', amount: 100, owner: 'A' } },
    dataBag: {}
  };

  it('evaluates legacy single condition into AND block', () => {
    const r = evaluateProcessCondition(
      { condition: { field: 'event.currentState.stage', operator: 'equals', value: 'Qualified' } },
      ctx
    );
    assert.equal(r.ok, true);
    assert.equal(r.result, true);
  });

  it('Block1 AND requires all leaves', () => {
    const pass = evaluateProcessCondition(
      {
        conditionGroup: {
          blockCombinator: 'AND',
          andBlock: {
            conditions: [
              { field: 'event.currentState.stage', operator: 'equals', value: 'Qualified' },
              { field: 'event.currentState.amount', operator: 'greater_than', value: 50 }
            ]
          },
          orBlock: { conditions: [] }
        }
      },
      ctx
    );
    assert.equal(pass.result, true);

    const fail = evaluateProcessCondition(
      {
        conditionGroup: {
          blockCombinator: 'AND',
          andBlock: {
            conditions: [
              { field: 'event.currentState.stage', operator: 'equals', value: 'Qualified' },
              { field: 'event.currentState.amount', operator: 'greater_than', value: 500 }
            ]
          },
          orBlock: { conditions: [] }
        }
      },
      ctx
    );
    assert.equal(fail.result, false);
  });

  it('Block2 OR matches any leaf', () => {
    const r = evaluateProcessCondition(
      {
        conditionGroup: {
          blockCombinator: 'AND',
          andBlock: { conditions: [] },
          orBlock: {
            conditions: [
              { field: 'event.currentState.stage', operator: 'equals', value: 'Lost' },
              { field: 'event.currentState.amount', operator: 'greater_than', value: 50 }
            ]
          }
        }
      },
      ctx
    );
    assert.equal(r.result, true);
  });

  it('between blocks AND requires both blocks', () => {
    const pass = evaluateProcessCondition(
      {
        conditionGroup: {
          blockCombinator: 'AND',
          andBlock: {
            conditions: [
              { field: 'event.currentState.stage', operator: 'equals', value: 'Qualified' }
            ]
          },
          orBlock: {
            conditions: [
              { field: 'event.currentState.owner', operator: 'equals', value: 'A' },
              { field: 'event.currentState.owner', operator: 'equals', value: 'B' }
            ]
          }
        }
      },
      ctx
    );
    assert.equal(pass.result, true);

    const fail = evaluateProcessCondition(
      {
        conditionGroup: {
          blockCombinator: 'AND',
          andBlock: {
            conditions: [
              { field: 'event.currentState.stage', operator: 'equals', value: 'Lost' }
            ]
          },
          orBlock: {
            conditions: [
              { field: 'event.currentState.owner', operator: 'equals', value: 'A' }
            ]
          }
        }
      },
      ctx
    );
    assert.equal(fail.result, false);
  });

  it('between blocks OR passes when either block matches', () => {
    const r = evaluateProcessCondition(
      {
        conditionGroup: {
          blockCombinator: 'OR',
          andBlock: {
            conditions: [
              { field: 'event.currentState.stage', operator: 'equals', value: 'Lost' }
            ]
          },
          orBlock: {
            conditions: [
              { field: 'event.currentState.amount', operator: 'greater_than', value: 50 }
            ]
          }
        }
      },
      ctx
    );
    assert.equal(r.result, true);
  });

  it('participations multi-app contains any selected app', () => {
    const r = evaluateProcessCondition(
      {
        conditionGroup: {
          blockCombinator: 'AND',
          andBlock: {
            conditions: [
              {
                field: 'event.currentState.participations',
                operator: 'contains',
                value: ['HELPDESK', 'SALES']
              }
            ]
          },
          orBlock: { conditions: [] }
        }
      },
      {
        event: { currentState: { participations: { SALES: { role: 'Lead' } } } },
        dataBag: {}
      }
    );
    assert.equal(r.result, true);
  });

  it('participations equals requires all selected apps', () => {
    const r = evaluateProcessCondition(
      {
        conditionGroup: {
          blockCombinator: 'AND',
          andBlock: {
            conditions: [
              {
                field: 'event.currentState.participations',
                operator: 'equals',
                value: ['SALES', 'HELPDESK']
              }
            ]
          },
          orBlock: { conditions: [] }
        }
      },
      {
        event: { currentState: { participations: { SALES: { role: 'Lead' } } } },
        dataBag: {}
      }
    );
    assert.equal(r.result, false);
  });

  it('resolves expression valueMode against trigger fields', () => {
    const r = evaluateProcessCondition(
      {
        conditionGroup: {
          blockCombinator: 'AND',
          andBlock: {
            conditions: [
              {
                field: 'event.currentState.stage',
                operator: 'equals',
                valueMode: 'expression',
                expression: 'uppercase(trigger.stage)'
              }
            ]
          },
          orBlock: { conditions: [] }
        }
      },
      {
        event: { currentState: { stage: 'Qualified' } },
        dataBag: {}
      }
    );
    assert.equal(r.ok, true);
    // field is Qualified, expression uppercase(trigger.stage) => QUALIFIED — not equal
    assert.equal(r.result, false);

    const pass = evaluateProcessCondition(
      {
        conditionGroup: {
          blockCombinator: 'AND',
          andBlock: {
            conditions: [
              {
                field: 'event.currentState.stage',
                operator: 'equals',
                valueMode: 'expression',
                expression: '"Qualified"'
              }
            ]
          },
          orBlock: { conditions: [] }
        }
      },
      {
        event: { currentState: { stage: 'Qualified' } },
        dataBag: {}
      }
    );
    assert.equal(pass.ok, true);
    assert.equal(pass.result, true);
  });

  it('builds mongo filter from condition group', () => {
    const { conditionGroupToMongoFilter } = require('../processConditionEvaluator');
    const filter = conditionGroupToMongoFilter(
      {
        blockCombinator: 'AND',
        andBlock: {
          conditions: [
            { field: 'sales_type', operator: 'equals', value: 'Lead' },
            { field: 'amount', operator: 'greater_than', value: 10 }
          ]
        },
        orBlock: { conditions: [] }
      },
      {}
    );
    assert.deepEqual(filter, {
      $and: [{ sales_type: 'Lead' }, { amount: { $gt: 10 } }]
    });
  });
});