'use strict';

const Campaign = require('../../models/Campaign');
const {
  CAMPAIGN_SEND_QUEUE_LAG_ALERT_MS
} = require('./campaignSendConstants');
const {
  recordCampaignSendQueueLag,
  pushCampaignSendAlert
} = require('./campaignSendMetrics');
const { getCampaignSendQueueState } = require('./campaignSendQueueService');

/**
 * @returns {Promise<{ alerts: object[], checkedAt: string }>}
 */
async function checkCampaignSendAlerts() {
  /** @type {object[]} */
  const alerts = [];

  const queueState = await getCampaignSendQueueState();
  if (queueState.available && queueState.oldestWaitingLagMs > CAMPAIGN_SEND_QUEUE_LAG_ALERT_MS) {
    recordCampaignSendQueueLag(queueState.oldestWaitingLagMs);
    const alert = {
      type: 'queue_lag',
      message: `Campaign send queue lag ${Math.round(queueState.oldestWaitingLagMs / 1000)}s exceeds threshold`,
      details: queueState
    };
    alerts.push(alert);
    pushCampaignSendAlert(alert);
  }

  const since = new Date(Date.now() - 60 * 60 * 1000);
  const failedCampaigns = await Campaign.find({
    'sendState.phase': 'failed',
    updatedAt: { $gte: since }
  })
    .select('name organizationId sendState.error updatedAt')
    .sort({ updatedAt: -1 })
    .limit(20)
    .lean();

  for (const campaign of failedCampaigns) {
    const alert = {
      type: 'send_failed',
      message: `Campaign "${campaign.name}" send failed`,
      details: {
        campaignId: String(campaign._id),
        organizationId: String(campaign.organizationId),
        error: campaign.sendState?.error || null,
        failedAt: campaign.updatedAt
      }
    };
    alerts.push(alert);
    pushCampaignSendAlert(alert);
  }

  return {
    checkedAt: new Date().toISOString(),
    alerts
  };
}

module.exports = {
  checkCampaignSendAlerts
};
