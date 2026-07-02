'use strict';

const { retryFailedPolicySyncs } = require('./amds-policy-sync');
const { isAmdsEnvConfigured } = require('../../config/amds');

/**
 * Retry OrgEmailPolicy documents that failed AMDS sync.
 * @returns {Promise<{ attempted: number, succeeded: number, failed: number }|null>}
 */
async function tickAmdsPolicySyncRetry() {
  if (!isAmdsEnvConfigured()) {
    return null;
  }
  return retryFailedPolicySyncs({ limit: 50 });
}

module.exports = {
  tickAmdsPolicySyncRetry
};
