'use strict';

const segmentQueryService = require('./marketingSegmentQueryService');

const ENABLE_MARKETING_SEGMENT_REFRESH_SCHEDULER =
  process.env.ENABLE_MARKETING_SEGMENT_REFRESH_SCHEDULER !== 'false';

async function tickMarketingSegmentRefresh() {
  if (!ENABLE_MARKETING_SEGMENT_REFRESH_SCHEDULER) {
    return { skipped: true };
  }

  return segmentQueryService.refreshAllSegmentCounts();
}

module.exports = {
  tickMarketingSegmentRefresh,
  ENABLE_MARKETING_SEGMENT_REFRESH_SCHEDULER
};
