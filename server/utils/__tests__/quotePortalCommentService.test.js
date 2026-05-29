const test = require('node:test');
const assert = require('node:assert/strict');

const { serializePortalComment } = require('../../services/quotePortalCommentService');

test('serializePortalComment: customer with signer name', () => {
  const row = serializePortalComment({
    _id: 'abc',
    content: 'Hello',
    author: null,
    details: { actorLabel: 'customer', signerName: 'Jane Doe', portalThread: true },
    createdAt: new Date('2026-05-28T12:00:00Z')
  });
  assert.equal(row.authorLabel, 'Jane Doe');
  assert.equal(row.isCustomer, true);
  assert.equal(row.content, 'Hello');
});

test('serializePortalComment: customer without name', () => {
  const row = serializePortalComment({
    _id: 'abc',
    content: 'Hi',
    author: null,
    details: { actorLabel: 'customer', portalThread: true },
    createdAt: new Date()
  });
  assert.equal(row.authorLabel, 'Customer');
});

test('serializePortalComment: team member', () => {
  const row = serializePortalComment({
    _id: 'abc',
    content: 'Reply',
    author: { firstName: 'Sam', lastName: 'Lee', email: 'sam@example.com' },
    details: { portalThread: true },
    createdAt: new Date()
  });
  assert.equal(row.authorLabel, 'Sam Lee');
  assert.equal(row.isCustomer, false);
});
