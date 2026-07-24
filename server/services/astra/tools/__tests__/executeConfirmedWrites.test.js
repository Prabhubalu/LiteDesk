'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  executeDealUpdate,
  executeNotesCreate,
  executeNotImplemented,
} = require('../executeConfirmedWrites');

describe('executeConfirmedWrites guards', () => {
  it('deal update requires dealId and patch', async () => {
    const missingId = await executeDealUpdate({ stage: 'Proposal' }, { organizationId: 'o1' });
    assert.equal(missingId.ok, false);
    assert.match(missingId.guidance, /dealId/i);

    const emptyPatch = await executeDealUpdate({ dealId: 'd1' }, { organizationId: 'o1' });
    assert.equal(emptyPatch.ok, false);
    assert.match(emptyPatch.guidance, /field/i);
  });

  it('notes require body and related record', async () => {
    const empty = await executeNotesCreate({ body: '' }, { organizationId: 'o1', userId: 'u1' });
    assert.equal(empty.ok, false);
    const noTarget = await executeNotesCreate({ body: 'Hello' }, { organizationId: 'o1', userId: 'u1' });
    assert.equal(noTarget.ok, false);
    assert.match(noTarget.guidance, /relate/i);
  });

  it('unimplemented actions fail honestly', async () => {
    const r = await executeNotImplemented('refunds.create', 'Create refund');
    assert.equal(r.ok, false);
    assert.match(r.guidance, /cannot be completed|Arivu/i);
  });
});
