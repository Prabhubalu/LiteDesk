'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const tenantContext = require('../../../utils/runWithOrganizationTenant');

test('mapPersonToSendRecipient builds mergeData with personId', () => {
  const { mapPersonToSendRecipient } = require('../marketingAudienceQueryCompiler');
  const personId = new mongoose.Types.ObjectId();
  const recipient = mapPersonToSendRecipient({
    _id: personId,
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'Ada@Example.com'
  });

  assert.ok(recipient);
  assert.equal(recipient.email, 'ada@example.com');
  assert.equal(recipient.recipientId, String(personId));
  assert.deepEqual(recipient.mergeData, { personId: String(personId) });
});

test('getRecipientResolveLimit removes cap for send purpose', () => {
  const { getRecipientResolveLimit } = require('../marketingAudienceConstants');
  assert.equal(getRecipientResolveLimit({ purpose: 'send' }), null);
  assert.equal(getRecipientResolveLimit({ purpose: 'preview' }), 5000);
});
