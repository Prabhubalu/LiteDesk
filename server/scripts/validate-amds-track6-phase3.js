'use strict';

/**
 * End-to-end Track 6 Phase 3 throughput + estimate validation (Arivu + AMDS must be running).
 *
 * Usage:
 *   node server/scripts/validate-amds-track6-phase3.js [organizationId] [campaignId]
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const OrgEmailPolicy = require('../models/org-email-policy');
const { getAmdsClient, isAmdsEnvConfigured } = require('../config/amds');
const {
  ensureOrgEmailPolicy,
  refreshOrgEmailThroughput,
  assertMarketingSendAllowed,
  MARKETING_MIN_SENDER_REPUTATION
} = require('../services/orgEmailPolicyService');
const { syncOrgPolicyToAmds } = require('../services/amds/amds-policy-sync');
const { processTenantEvent } = require('../services/amds/handlers/tenantEventHandler');
const { fetchCampaignSendEstimate } = require('../services/marketing/marketingCampaignCreditPrecheckService');

function log(step, message) {
  console.log(`[track6-phase3] ${step}: ${message}`);
}

async function resolveOrganizationId(argvOrgId) {
  if (argvOrgId && mongoose.Types.ObjectId.isValid(argvOrgId)) {
    return new mongoose.Types.ObjectId(argvOrgId);
  }
  const org = await Organization.findOne().select('_id').lean();
  if (!org?._id) throw new Error('No organization found — pass organizationId as argv[2]');
  return org._id;
}

async function main() {
  if (!isAmdsEnvConfigured()) {
    throw new Error('AMDS env is not configured (AMDS_BASE_URL, AMDS_API_KEY)');
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGO_URI is required');

  await mongoose.connect(mongoUri);
  const organizationId = await resolveOrganizationId(process.argv[2]);
  const orgIdStr = String(organizationId);
  const campaignId =
    process.argv[3] && mongoose.Types.ObjectId.isValid(process.argv[3])
      ? String(process.argv[3])
      : new mongoose.Types.ObjectId().toString();

  log('1', `Using organization ${orgIdStr}, campaign ${campaignId}`);

  await ensureOrgEmailPolicy(organizationId, 'PRO');
  await syncOrgPolicyToAmds(organizationId);

  const client = getAmdsClient();
  if (!client) throw new Error('AMDS client unavailable');

  let throughput;
  try {
    throughput = await client.getTenantThroughput(orgIdStr);
  } catch (err) {
    throw new Error(`AMDS getTenantThroughput failed: ${err.message || err}`);
  }

  if (typeof throughput.effective_hourly_rate !== 'number') {
    throw new Error('AMDS throughput response missing effective_hourly_rate');
  }
  log('2', `AMDS effective_hourly_rate=${throughput.effective_hourly_rate}`);

  await refreshOrgEmailThroughput(organizationId);
  let policy = await OrgEmailPolicy.findOne({ organizationId }).lean();
  if (policy?.effectiveHourlyRate == null) {
    throw new Error('MongoDB effectiveHourlyRate not populated after refresh');
  }
  log('3', `MongoDB cached effectiveHourlyRate=${policy.effectiveHourlyRate}`);

  await processTenantEvent({
    event_id: `track6-phase3-${Date.now()}`,
    timestamp: new Date().toISOString(),
    event_type: 'throughput.updated',
    tenant_id: orgIdStr,
    throughput: {
      effective_hourly_rate: Math.max(0, throughput.effective_hourly_rate - 100),
      effective_burst_rate: throughput.effective_burst_rate ?? 0,
      multipliers: { warmup_stage: 'validation_stage' }
    }
  });

  policy = await OrgEmailPolicy.findOne({ organizationId }).lean();
  if (policy?.warmupStage !== 'validation_stage') {
    throw new Error(`Expected warmupStage=validation_stage, got ${policy?.warmupStage}`);
  }
  log('4', 'throughput.updated webhook updated MongoDB');

  const estimate = await fetchCampaignSendEstimate(organizationId, campaignId, 25_000);
  if (!estimate) {
    log('5', 'Campaign estimate unavailable (AMDS may not expose estimate yet) — skipping');
  } else {
    log('5', `Campaign estimate seconds=${estimate.estimatedSeconds ?? 'null'}`);
  }

  await OrgEmailPolicy.findOneAndUpdate(
    { organizationId },
    { $set: { senderReputation: MARKETING_MIN_SENDER_REPUTATION - 1, reputationEnabled: true } }
  );
  const blocked = await assertMarketingSendAllowed(organizationId);
  if (blocked.allowed) {
    throw new Error('Expected marketing send blocked when reputation below minimum');
  }
  log('6', `assertMarketingSendAllowed blocked with code=${blocked.code}`);

  console.log('\n✅ Track 6 Phase 3 validation passed');
}

main()
  .catch((err) => {
    console.error('\n❌ Track 6 Phase 3 validation failed:', err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  });
