'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { partitionRecipientsBySubscription } = require('../marketingSubscriptionService');

test('partitionRecipientsBySubscription splits subscribed and unsubscribed emails', () => {
  const preferenceByEmail = new Map([
    ['blocked@example.com', { globalStatus: 'unsubscribed', categories: {} }],
    ['promo-off@example.com', { globalStatus: 'subscribed', categories: { marketing: { subscribed: false } } }]
  ]);

  const { subscribed, unsubscribedEmails } = partitionRecipientsBySubscription(
    [
      { email: 'ok@example.com', recipientId: '1' },
      { email: 'blocked@example.com', recipientId: '2' },
      { email: 'promo-off@example.com', recipientId: '3' }
    ],
    preferenceByEmail
  );

  assert.equal(subscribed.length, 1);
  assert.equal(subscribed[0].email, 'ok@example.com');
  assert.deepEqual(unsubscribedEmails.sort(), ['blocked@example.com', 'promo-off@example.com'].sort());
});
