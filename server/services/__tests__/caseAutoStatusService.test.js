'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createInitialSlaCycle } = require('../caseLifecycleService');
const {
  resolveAgentReplyTargetStatus,
  resolveCustomerInboundTargetStatus,
  maybeAutoTransitionCaseStatus
} = require('../caseAutoStatusService');

function makeCase(overrides = {}) {
  return {
    status: 'New',
    channel: 'Email',
    activities: [],
    currentSlaCycle: createInitialSlaCycle(1, new Date('2026-01-01T09:00:00Z')),
    ...overrides
  };
}

test('resolveAgentReplyTargetStatus moves New to In Progress', () => {
  assert.equal(resolveAgentReplyTargetStatus('New', 'Email'), 'In Progress');
});

test('resolveAgentReplyTargetStatus moves In Progress to Waiting for Customer', () => {
  assert.equal(resolveAgentReplyTargetStatus('In Progress', 'Email'), 'Waiting for Customer');
});

test('resolveAgentReplyTargetStatus keeps Live Chat In Progress', () => {
  assert.equal(resolveAgentReplyTargetStatus('In Progress', 'Live Chat'), null);
});

test('resolveCustomerInboundTargetStatus moves Waiting for Customer to In Progress', () => {
  assert.equal(resolveCustomerInboundTargetStatus('Waiting for Customer'), 'In Progress');
});

test('maybeAutoTransitionCaseStatus applies agent reply from Assigned', () => {
  const caseRecord = makeCase({ status: 'Assigned' });
  const result = maybeAutoTransitionCaseStatus(caseRecord, {
    activityType: 'email_sent',
    internal: true,
    actorId: '507f1f77bcf86cd799439011',
    actorName: 'Agent'
  });

  assert.equal(result.changed, true);
  assert.equal(result.fromStatus, 'Assigned');
  assert.equal(result.toStatus, 'In Progress');
  assert.equal(caseRecord.status, 'In Progress');
  assert.equal(caseRecord.activities.at(-1).activityType, 'status_changed');
  assert.equal(caseRecord.activities.at(-1).metadata.automatic, true);
});

test('maybeAutoTransitionCaseStatus applies customer inbound from Waiting for Customer', () => {
  const caseRecord = makeCase({ status: 'Waiting for Customer' });
  const result = maybeAutoTransitionCaseStatus(caseRecord, {
    activityType: 'email_received',
    internal: false,
    actorId: null,
    actorName: 'customer@example.com'
  });

  assert.equal(result.changed, true);
  assert.equal(result.toStatus, 'In Progress');
  assert.equal(caseRecord.currentSlaCycle.status, 'running');
});

test('maybeAutoTransitionCaseStatus does not change Closed cases', () => {
  const caseRecord = makeCase({ status: 'Closed' });
  const result = maybeAutoTransitionCaseStatus(caseRecord, {
    activityType: 'email_received',
    internal: false
  });

  assert.equal(result.changed, false);
  assert.equal(caseRecord.status, 'Closed');
});
