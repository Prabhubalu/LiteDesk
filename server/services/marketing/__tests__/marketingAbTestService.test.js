'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateAbTestConfig,
  partitionAbRecipients,
  pickAbWinner
} = require('../marketingAbTestService');

test('validateAbTestConfig passes with two subject variants', () => {
  const result = validateAbTestConfig({
    abTest: { enabled: true, samplePercent: 20 },
    variants: [
      { key: 'A', subject: 'Hello A', splitPercent: 50 },
      { key: 'B', subject: 'Hello B', splitPercent: 50 }
    ]
  });
  assert.equal(result.valid, true);
});

test('validateAbTestConfig rejects invalid split total', () => {
  const result = validateAbTestConfig({
    abTest: { enabled: true, samplePercent: 20 },
    variants: [
      { key: 'A', subject: 'Hello A', splitPercent: 40 },
      { key: 'B', subject: 'Hello B', splitPercent: 40 }
    ]
  });
  assert.equal(result.valid, false);
});

test('partitionAbRecipients assigns sample and held-back groups', () => {
  const recipients = Array.from({ length: 10 }, (_, index) => ({
    email: `user${index}@example.com`,
    recipientId: `id-${index}`
  }));

  const { testRecipients, heldBackRecipients } = partitionAbRecipients(
    recipients,
    [
      { key: 'A', subject: 'A subject', splitPercent: 50 },
      { key: 'B', subject: 'B subject', splitPercent: 50 }
    ],
    20
  );

  assert.equal(testRecipients.length, 2);
  assert.equal(heldBackRecipients.length, 8);
  assert.ok(testRecipients.every((row) => row.subject && row.variantKey));
});

test('pickAbWinner prefers higher open rate', () => {
  const picked = pickAbWinner({
    abTest: { winnerMetric: 'open_rate' },
    variants: [
      { key: 'A', subject: 'A', stats: { totalRecipients: 100, uniqueOpens: 10 } },
      { key: 'B', subject: 'B', stats: { totalRecipients: 100, uniqueOpens: 25 } }
    ]
  });

  assert.equal(picked.variantKey, 'B');
});
