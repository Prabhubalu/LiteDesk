'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  buildRecentActivity,
  compareCampaigns
} = require('../marketingDashboardService');

const Campaign = require('../../../models/Campaign');

test('buildRecentActivity prioritizes sent and scheduled events', () => {
  const now = new Date();
  const activity = buildRecentActivity([
    {
      _id: '1',
      name: 'Draft promo',
      status: 'draft',
      updatedAt: now
    },
    {
      _id: '2',
      name: 'Scheduled launch',
      status: 'scheduled',
      scheduledAt: new Date(now.getTime() + 60_000),
      updatedAt: now
    },
    {
      _id: '3',
      name: 'Summer sale',
      status: 'completed',
      sendCompletedAt: new Date(now.getTime() + 120_000),
      updatedAt: now
    }
  ]);

  assert.equal(activity[0].type, 'sent');
  assert.equal(activity[0].campaignName, 'Summer sale');
  assert.ok(activity.some((item) => item.type === 'scheduled'));
});

test('compareCampaigns validates ids and limit', async () => {
  await assert.rejects(
    () => compareCampaigns(new mongoose.Types.ObjectId(), []),
    /at least one campaign id/i
  );

  const ids = Array.from({ length: 6 }, () => String(new mongoose.Types.ObjectId()));
  await assert.rejects(
    () => compareCampaigns(new mongoose.Types.ObjectId(), ids),
    /compare up to 5/i
  );
});

test('compareCampaigns returns ordered comparison rows', async (t) => {
  const orgId = new mongoose.Types.ObjectId();
  const idA = new mongoose.Types.ObjectId();
  const idB = new mongoose.Types.ObjectId();

  const originalFind = Campaign.find;
  Campaign.find = () => ({
    select: () => ({
      lean: async () => [
        {
          _id: idB,
          name: 'Beta',
          subject: 'B',
          status: 'completed',
          updatedAt: new Date(),
          stats: {
            totalRecipients: 100,
            delivered: 95,
            uniqueOpens: 40,
            uniqueClicks: 10,
            openRate: 0.4,
            clickRate: 0.1,
            sendCompletedAt: new Date()
          }
        }
      ]
    })
  });

  t.after(() => {
    Campaign.find = originalFind;
  });

  const rows = await compareCampaigns(orgId, [String(idA), String(idB)]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].found, false);
  assert.equal(rows[1].found, true);
  assert.equal(rows[1].name, 'Beta');
  assert.equal(rows[1].stats.delivered, 95);
});
