'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  COMMERCIAL_ACTIONS,
  COLLECTION_ACTIONS,
  parseCommercialProposalsJson,
  parseCollectionProposalsJson,
} = require('../aiCommercialAgentService');
const { getPrompt } = require('../prompts/promptRegistry');

describe('aiCommercialAgentService', () => {
  it('constrains commercial actions to allow-list', () => {
    const { proposals } = parseCommercialProposalsJson(JSON.stringify({
      summary: 'Ready with gaps',
      proposals: [
        { action: 'create_quote', label: 'Create quote', rationale: 'Lines ready', confidence: 0.8 },
        { action: 'hack_db', label: 'Bad', rationale: 'nope', confidence: 1 },
      ],
    }));
    assert.equal(proposals.length, 2);
    assert.equal(proposals[0].action, 'create_quote');
    assert.equal(proposals[1].action, 'manual_review');
    assert.equal(proposals[0].confirmRequired, true);
  });

  it('drops collection proposals with unknown invoiceIds', () => {
    const { proposals } = parseCollectionProposalsJson(
      JSON.stringify({
        summary: 'Chase overdue',
        proposals: [
          {
            action: 'propose_payment_link',
            label: 'Payment link',
            rationale: 'Largest balance',
            confidence: 0.9,
            params: { invoiceId: 'inv-1' },
          },
          {
            action: 'propose_payment_link',
            label: 'Injected',
            rationale: 'evil',
            confidence: 1,
            params: { invoiceId: 'not-real' },
          },
        ],
      }),
      ['inv-1', 'inv-2']
    );
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0].params.invoiceId, 'inv-1');
  });

  it('maps unknown collection actions to manual_review', () => {
    const { proposals } = parseCollectionProposalsJson(
      JSON.stringify({
        proposals: [{ action: 'auto_charge_card', label: 'Charge', rationale: 'x', confidence: 1 }],
      }),
      []
    );
    assert.equal(proposals[0].action, 'manual_review');
  });

  it('returns empty on garbage JSON', () => {
    assert.deepEqual(parseCommercialProposalsJson('nope').proposals, []);
    assert.deepEqual(parseCollectionProposalsJson('nope', []).proposals, []);
  });

  it('registers commercial and collection agent prompts', () => {
    const commercial = getPrompt('commercial_agent_system');
    const collection = getPrompt('collection_agent_system');
    assert.equal(commercial.version, 'v1');
    assert.equal(collection.version, 'v1');
    assert.match(commercial.text, /Propose-only/);
    assert.match(collection.text, /Only use invoiceIds/);
    assert.ok(COMMERCIAL_ACTIONS.has('create_quote'));
    assert.ok(COLLECTION_ACTIONS.has('propose_payment_link'));
  });
});
