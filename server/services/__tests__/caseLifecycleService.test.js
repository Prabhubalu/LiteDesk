'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyStatusToSlaCycle,
  createInitialSlaCycle
} = require('../caseLifecycleService');

test('applyStatusToSlaCycle pauses on Waiting for Customer', () => {
  const now = new Date('2026-01-01T10:00:00Z');
  const cycle = createInitialSlaCycle(1, new Date('2026-01-01T09:00:00Z'));
  const paused = applyStatusToSlaCycle(cycle, 'Waiting for Customer', now);
  assert.equal(paused.status, 'paused');
  assert.equal(paused.pausedAt.toISOString(), now.toISOString());
});

test('applyStatusToSlaCycle records pause segment on resume', () => {
  const pauseStart = new Date('2026-01-01T10:00:00Z');
  const resumeAt = new Date('2026-01-01T11:00:00Z');
  let cycle = createInitialSlaCycle(1, new Date('2026-01-01T09:00:00Z'));
  cycle = applyStatusToSlaCycle(cycle, 'Waiting for Customer', pauseStart);
  cycle = applyStatusToSlaCycle(cycle, 'In Progress', resumeAt);
  assert.equal(cycle.status, 'running');
  assert.equal(cycle.pausedAt, null);
  assert.equal(cycle.pauseSegments.length, 1);
  assert.equal(cycle.pauseSegments[0].from.toISOString(), pauseStart.toISOString());
  assert.equal(cycle.pauseSegments[0].to.toISOString(), resumeAt.toISOString());
});

test('applyStatusToSlaCycle closes pause segment when resolving', () => {
  const pauseStart = new Date('2026-01-01T10:00:00Z');
  const resolvedAt = new Date('2026-01-01T12:00:00Z');
  let cycle = createInitialSlaCycle(1, new Date('2026-01-01T09:00:00Z'));
  cycle = applyStatusToSlaCycle(cycle, 'On Hold', pauseStart);
  cycle = applyStatusToSlaCycle(cycle, 'Resolved', resolvedAt);
  assert.equal(cycle.status, 'stopped');
  assert.equal(cycle.pauseSegments.length, 1);
  assert.equal(cycle.stoppedAt.toISOString(), resolvedAt.toISOString());
});
