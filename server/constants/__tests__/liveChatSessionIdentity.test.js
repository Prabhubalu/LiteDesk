'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeVisitorType,
  normalizeSessionPriority,
  inferVisitorTypeFromVisitor,
  LIVE_CHAT_VISITOR_TYPES,
} = require('../liveChatSessionIdentity');
const { buildAgentSessionFieldPatch } = require('../liveChatSessionFields');
const {
  buildDenormalizedLinkFields,
  resolveVisitorTypeAfterLink,
} = require('../../services/liveChatSessionIdentityService');

test('normalizeVisitorType accepts known values', () => {
  assert.equal(normalizeVisitorType('customer'), 'customer');
  assert.equal(normalizeVisitorType('INVALID'), null);
});

test('inferVisitorTypeFromVisitor distinguishes anonymous and known', () => {
  assert.equal(inferVisitorTypeFromVisitor({}), LIVE_CHAT_VISITOR_TYPES.ANONYMOUS);
  assert.equal(
    inferVisitorTypeFromVisitor({ email: 'a@example.com' }),
    LIVE_CHAT_VISITOR_TYPES.KNOWN_VISITOR,
  );
});

test('buildAgentSessionFieldPatch supports identity fields', () => {
  const patch = buildAgentSessionFieldPatch({
    visitorType: 'partner',
    priority: 'high',
    internalNotes: ' VIP account ',
  });
  assert.equal(patch.visitorType, 'partner');
  assert.equal(patch.priority, 'high');
  assert.equal(patch.internalNotes, 'VIP account');
});

test('buildDenormalizedLinkFields extracts people and organizations', () => {
  const links = buildDenormalizedLinkFields([
    { moduleKey: 'people', recordId: '507f1f77bcf86cd799439011' },
    { moduleKey: 'organizations', recordId: '507f1f77bcf86cd799439012' },
  ]);
  assert.equal(String(links.linkedContactId), '507f1f77bcf86cd799439011');
  assert.equal(String(links.linkedOrganizationId), '507f1f77bcf86cd799439012');
});

test('resolveVisitorTypeAfterLink promotes linked sessions to customer', () => {
  const type = resolveVisitorTypeAfterLink({
    currentVisitorType: 'known_visitor',
    linkedRecords: [{ moduleKey: 'people', recordId: '507f1f77bcf86cd799439011' }],
  });
  assert.equal(type, 'customer');
});
