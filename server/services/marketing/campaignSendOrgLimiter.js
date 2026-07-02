'use strict';

const { CAMPAIGN_SEND_MAX_CONCURRENT_PER_ORG } = require('./campaignSendConstants');

/** @type {Map<string, number>} */
const orgActiveCounts = new Map();
/** @type {Map<string, Array<() => void>>} */
const orgWaitQueues = new Map();

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {number} [maxConcurrent]
 */
async function acquireCampaignSendOrgSlot(organizationId, maxConcurrent = CAMPAIGN_SEND_MAX_CONCURRENT_PER_ORG) {
  const key = String(organizationId);
  const limit = Math.max(1, Number(maxConcurrent) || CAMPAIGN_SEND_MAX_CONCURRENT_PER_ORG);
  const active = orgActiveCounts.get(key) || 0;

  if (active < limit) {
    orgActiveCounts.set(key, active + 1);
    return;
  }

  await new Promise((resolve) => {
    const queue = orgWaitQueues.get(key) || [];
    queue.push(resolve);
    orgWaitQueues.set(key, queue);
  });

  return acquireCampaignSendOrgSlot(organizationId, limit);
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 */
function releaseCampaignSendOrgSlot(organizationId) {
  const key = String(organizationId);
  const active = Math.max(0, (orgActiveCounts.get(key) || 1) - 1);
  orgActiveCounts.set(key, active);

  const queue = orgWaitQueues.get(key) || [];
  if (queue.length === 0) return;

  orgActiveCounts.set(key, active + 1);
  const resume = queue.shift();
  orgWaitQueues.set(key, queue);
  resume();
}

function getCampaignSendOrgLimiterSnapshot() {
  return {
    maxConcurrentPerOrg: CAMPAIGN_SEND_MAX_CONCURRENT_PER_ORG,
    activeByOrg: Object.fromEntries(orgActiveCounts.entries()),
    waitingByOrg: Object.fromEntries(
      [...orgWaitQueues.entries()].map(([orgId, queue]) => [orgId, queue.length])
    )
  };
}

module.exports = {
  acquireCampaignSendOrgSlot,
  releaseCampaignSendOrgSlot,
  getCampaignSendOrgLimiterSnapshot
};
