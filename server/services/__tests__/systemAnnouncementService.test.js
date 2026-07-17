'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  daysUntil,
  trialCopy,
  subscriptionCopy,
} = require('../systemAnnouncementService');

describe('systemAnnouncementService copy helpers', () => {
  it('computes daysUntil ceil', () => {
    const now = new Date('2026-07-15T12:00:00.000Z');
    const inThreeDays = new Date('2026-07-18T12:00:00.000Z');
    assert.equal(daysUntil(inThreeDays, now), 3);
  });

  it('builds trial copy for countdown and expired', () => {
    const d7 = trialCopy(7);
    assert.match(d7.title, /7 days/);
    assert.equal(d7.ctaLabel, 'Upgrade Now');
    const expired = trialCopy(0);
    assert.match(expired.title, /expired/i);
    assert.equal(expired.priority, 'critical');
  });

  it('builds subscription copy for thresholds', () => {
    assert.match(subscriptionCopy(30).title, /30 days/);
    assert.match(subscriptionCopy(1).title, /tomorrow/i);
    assert.match(subscriptionCopy(0).title, /expired/i);
  });
});
