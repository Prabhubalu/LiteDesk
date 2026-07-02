'use strict';

const { processDueScheduledCampaigns } = require('./marketingCampaignScheduleService');

const ENABLE_MARKETING_CAMPAIGN_SCHEDULE_SCHEDULER =
  process.env.ENABLE_MARKETING_CAMPAIGN_SCHEDULE_SCHEDULER !== 'false';

async function tickMarketingCampaignSchedule() {
  if (!ENABLE_MARKETING_CAMPAIGN_SCHEDULE_SCHEDULER) {
    return { skipped: true };
  }

  return processDueScheduledCampaigns();
}

module.exports = {
  tickMarketingCampaignSchedule,
  ENABLE_MARKETING_CAMPAIGN_SCHEDULE_SCHEDULER
};
