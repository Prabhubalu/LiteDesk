'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DateTime } = require('luxon');
const { legacyHelpdeskHoursToSchedule } = require('../helpdeskBusinessHoursService');
const {
  computeMetricProgress,
  computeCycleSlaProgress,
  tryMarkResponseSlaMetOnCycle,
  elapsedMinutesForCycle
} = require('../helpdeskSlaClockService');

test('computeMetricProgress uses business minutes and excludes pause segments', () => {
  const schedule = legacyHelpdeskHoursToSchedule({
    timezone: 'America/New_York',
    workingDays: [1, 2, 3, 4, 5],
    startTime: '09:00',
    endTime: '18:00'
  });
  const startedAt = DateTime.fromObject(
    { year: 2026, month: 5, day: 11, hour: 9, minute: 0 },
    { zone: 'America/New_York' }
  );
  const now = DateTime.fromObject(
    { year: 2026, month: 5, day: 11, hour: 11, minute: 0 },
    { zone: 'America/New_York' }
  );
  const cycle = {
    startedAt: startedAt.toJSDate(),
    status: 'running',
    pauseSegments: [{
      from: DateTime.fromObject(
        { year: 2026, month: 5, day: 11, hour: 9, minute: 30 },
        { zone: 'America/New_York' }
      ).toJSDate(),
      to: DateTime.fromObject(
        { year: 2026, month: 5, day: 11, hour: 10, minute: 30 },
        { zone: 'America/New_York' }
      ).toJSDate()
    }],
    policySnapshot: {
      resolutionMinutes: 240
    }
  };

  const progress = computeMetricProgress(
    cycle,
    'resolution',
    { useCalendarTime: false, schedule },
    now.toJSDate()
  );

  assert.equal(progress.elapsedMinutes, 60);
  assert.equal(progress.state, 'ok');
});

test('computeMetricProgress marks response met', () => {
  const cycle = {
    startedAt: new Date('2026-01-01T09:00:00Z'),
    responseMetAt: new Date('2026-01-01T09:15:00Z'),
    policySnapshot: { firstResponseMinutes: 60 }
  };
  const progress = computeMetricProgress(cycle, 'response', { useCalendarTime: true, schedule: null });
  assert.equal(progress.state, 'met');
  assert.equal(progress.met, true);
});

test('paused cycle stops elapsed time at pausedAt', () => {
  const startedAt = new Date('2026-01-01T09:00:00Z');
  const pausedAt = new Date('2026-01-01T09:30:00Z');
  const now = new Date('2026-01-01T11:00:00Z');
  const cycle = {
    startedAt,
    status: 'paused',
    pausedAt,
    pauseSegments: [],
    policySnapshot: { resolutionMinutes: 120 }
  };
  const elapsed = elapsedMinutesForCycle(cycle, { useCalendarTime: true, schedule: null }, now);
  assert.equal(elapsed, 30);
});

test('tryMarkResponseSlaMetOnCycle ignores customer inbound activities', () => {
  const cycle = { responseMetAt: null, status: 'running' };
  const marked = tryMarkResponseSlaMetOnCycle(cycle, {
    activityType: 'email_received',
    internal: false,
    actorId: null
  });
  assert.equal(marked, false);
  assert.equal(cycle.responseMetAt, null);
});

test('tryMarkResponseSlaMetOnCycle marks agent replies', () => {
  const cycle = { responseMetAt: null, status: 'running' };
  const marked = tryMarkResponseSlaMetOnCycle(cycle, {
    activityType: 'agent_message',
    internal: false,
    actorId: '507f1f77bcf86cd799439011'
  });
  assert.equal(marked, true);
  assert.ok(cycle.responseMetAt);
});

test('computeCycleSlaProgress returns response and resolution metrics', () => {
  const cycle = {
    startedAt: new Date('2026-01-01T09:00:00Z'),
    policySnapshot: {
      firstResponseMinutes: 60,
      resolutionMinutes: 480
    }
  };
  const now = new Date('2026-01-01T09:50:00Z');
  const progress = computeCycleSlaProgress(cycle, { useCalendarTime: true, schedule: null }, now);
  assert.equal(progress.response.state, 'warning');
  assert.equal(progress.resolution.state, 'ok');
});
