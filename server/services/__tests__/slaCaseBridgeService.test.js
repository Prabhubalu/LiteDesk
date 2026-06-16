'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { syncCycleFromInstances } = require('../sla/slaCaseBridgeService');

describe('slaCaseBridgeService', () => {
  it('syncs legacy cycle fields from generic instances', () => {
    const cycle = {
      cycleNo: 1,
      startedAt: new Date('2026-01-01T09:00:00Z'),
      status: 'running',
      policySnapshot: {}
    };
    const instances = [
      {
        milestoneKey: 'first_response',
        policyKey: 'vip',
        targetAt: new Date('2026-01-01T10:00:00Z'),
        policySnapshot: { name: 'VIP', durationMinutes: 60 }
      },
      {
        milestoneKey: 'resolution',
        policyKey: 'vip',
        targetAt: new Date('2026-01-01T17:00:00Z'),
        policySnapshot: { durationMinutes: 480 }
      }
    ];

    const synced = syncCycleFromInstances(cycle, instances);
    assert.equal(synced.responseTargetAt.toISOString(), instances[0].targetAt.toISOString());
    assert.equal(synced.resolutionTargetAt.toISOString(), instances[1].targetAt.toISOString());
    assert.equal(synced.policySnapshot.firstResponseMinutes, 60);
    assert.equal(synced.policySnapshot.resolutionMinutes, 480);
    assert.equal(synced.policySnapshot.key, 'vip');
  });
});
