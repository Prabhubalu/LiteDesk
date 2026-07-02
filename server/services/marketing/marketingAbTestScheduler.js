'use strict';

const { processDueAbTests } = require('./marketingAbTestService');

const ENABLE_MARKETING_AB_TEST_SCHEDULER =
  process.env.ENABLE_MARKETING_AB_TEST_SCHEDULER !== 'false';

async function tickMarketingAbTests() {
  if (!ENABLE_MARKETING_AB_TEST_SCHEDULER) {
    return { skipped: true };
  }

  return processDueAbTests();
}

module.exports = {
  tickMarketingAbTests,
  ENABLE_MARKETING_AB_TEST_SCHEDULER
};
