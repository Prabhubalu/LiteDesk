'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeSessionTimingFields } = require('../liveChatSessionTimingUtils');

test('computeSessionTimingFields returns null metrics when timestamps missing', () => {
  const result = computeSessionTimingFields({ createdAt: new Date('2026-01-01T10:00:00Z') });
  assert.equal(result.waitTimeMs, null);
  assert.equal(result.firstResponseTimeMs, null);
  assert.equal(result.handleTimeMs, null);
});

test('computeSessionTimingFields computes wait, first response, and handle times', () => {
  const session = {
    createdAt: new Date('2026-01-01T10:00:00Z'),
    assignedAt: new Date('2026-01-01T10:02:00Z'),
    firstResponseAt: new Date('2026-01-01T10:05:00Z'),
    endedAt: new Date('2026-01-01T10:20:00Z'),
    status: 'closed',
  };

  const result = computeSessionTimingFields(session);
  assert.equal(result.waitTimeMs, 2 * 60 * 1000);
  assert.equal(result.firstResponseTimeMs, 3 * 60 * 1000);
  assert.equal(result.handleTimeMs, 18 * 60 * 1000);
});

test('computeSessionTimingFields uses lastMessageAt for closed sessions without endedAt', () => {
  const session = {
    createdAt: new Date('2026-01-01T10:00:00Z'),
    assignedAt: new Date('2026-01-01T10:01:00Z'),
    lastMessageAt: new Date('2026-01-01T10:11:00Z'),
    status: 'closed',
  };

  const result = computeSessionTimingFields(session);
  assert.equal(result.handleTimeMs, 10 * 60 * 1000);
});
