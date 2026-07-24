'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  interpretDealAsk,
  applyAskFidelity,
} = require('../answerFidelity');
const { buildUiBlocks } = require('../buildUiBlocks');

describe('answerFidelity', () => {
  it('detects near-closure asks', () => {
    const ask = interpretDealAsk('get me the list of deals which are near to the closure');
    assert.equal(ask?.id, 'near_close');
    assert.equal(ask?.listTitle, 'Deals near closure');
  });

  it('filters UI hits to late-stage deals only', () => {
    const raw = {
      entity: 'deals',
      openOnly: true,
      listIntent: true,
      hits: [
        { id: '1', title: 'Late A', subtitle: 'Contract Sent · Open', stage: 'Contract Sent', amount: 50000, status: 'Open' },
        { id: '2', title: 'Early B', subtitle: 'New · Open', stage: 'New', amount: 1000, status: 'Open' },
        { id: '3', title: 'Late C', subtitle: 'Negotiation · Open', stage: 'Negotiation', amount: 200000, status: 'Open' },
        { id: '4', title: 'Qual D', subtitle: 'Qualification · Open', stage: 'Qualification', amount: 9000, status: 'Open' },
      ],
      counts: { total: 4, returned: 4 },
    };
    const focused = applyAskFidelity(raw, 'deals near to the closure');
    assert.equal(focused.askFocus, 'near_close');
    assert.equal(focused.hits.length, 2);
    assert.equal(focused.hits[0].title, 'Late C'); // amount desc
    assert.equal(focused.listTitle, 'Deals near closure');
    assert.ok(focused.hits[0].actions?.length >= 1);

    const { lead, blocks } = buildUiBlocks('crm_search', focused, {
      listIntent: true,
      query: 'deals near to the closure',
    });
    assert.match(lead, /2|closest|close/i);
    const list = blocks.find((b) => b.type === 'record_list');
    assert.equal(list?.title, 'Deals near closure');
    assert.equal(list?.total, 2);
    assert.equal(list?.items?.length, 2);
    assert.ok(list.items.every((i) => /Contract|Negotiation/i.test(i.subtitle)));
    assert.ok(list.items[0].actions?.length);
    assert.ok(blocks.some((b) => b.type === 'metrics'));
  });
});
