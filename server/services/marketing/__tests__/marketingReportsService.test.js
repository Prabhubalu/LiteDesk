'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveReportRange, campaignsToCsvRows } = require('../marketingReportsService');

test('resolveReportRange defaults to 30 days', () => {
  const { from, to } = resolveReportRange({});
  assert.ok(from instanceof Date);
  assert.ok(to instanceof Date);
  assert.ok(to.getTime() >= from.getTime());
});

test('campaignsToCsvRows includes header and campaign row', () => {
  const csv = campaignsToCsvRows([
    {
      name: 'Launch',
      subject: 'Hello',
      status: 'completed',
      campaignType: 'standard',
      stats: {
        totalRecipients: 100,
        delivered: 95,
        uniqueOpens: 40,
        uniqueClicks: 10,
        openRate: 0.4,
        clickRate: 0.1,
        sendCompletedAt: '2026-07-01T12:00:00.000Z'
      }
    }
  ]);

  assert.match(csv, /^Campaign,/);
  assert.match(csv, /Launch/);
  assert.match(csv, /40\.00%/);
});
