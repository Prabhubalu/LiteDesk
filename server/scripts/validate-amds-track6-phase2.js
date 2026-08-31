'use strict';

/**
 * End-to-end Track 6 Phase 2 reputation validation (Arivu + AMDS must be running).
 *
 * Usage:
 *   node scripts/validate-amds-track6-phase2.js [organizationId]
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const OrgEmailPolicy = require('../models/org-email-policy');
const { getAmdsClient, isAmdsEnvConfigured } = require('../config/amds');
const { ensureOrgEmailPolicy, refreshOrgEmailReputation } = require('../services/orgEmailPolicyService');
const { syncOrgPolicyToAmds } = require('../services/amds/amds-policy-sync');
const { processTenantEvent } = require('../services/amds/handlers/tenantEventHandler');

function log(step, message) {
  console.log(`[track6-phase2] ${step}: ${message}`);
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

  log('1', `Using organization ${orgIdStr}`);

  await ensureOrgEmailPolicy(organizationId, 'PRO');
  await syncOrgPolicyToAmds(organizationId);

  const client = getAmdsClient();
  if (!client) throw new Error('AMDS client unavailable');

  let reputation;
  try {
    reputation = await client.getTenantReputation(orgIdStr);
  } catch (err) {
    throw new Error(`AMDS getTenantReputation failed: ${err.message || err}`);
  }

  if (typeof reputation.score !== 'number') {
    throw new Error('AMDS reputation response missing numeric score');
  }
  log('2', `AMDS reputation score=${reputation.score}`);

  await refreshOrgEmailReputation(organizationId);
  let policy = await OrgEmailPolicy.findOne({ organizationId }).lean();
  if (policy?.senderReputation == null) {
    throw new Error('MongoDB senderReputation not populated after refresh');
  }
  log('3', `MongoDB cached reputation=${policy.senderReputation}`);

  await processTenantEvent({
    event_id: `track6-phase2-${Date.now()}`,
    timestamp: new Date().toISOString(),
    event_type: 'reputation.updated',
    tenant_id: orgIdStr,
    reputation: {
      score: Math.max(0, reputation.score - 5),
      previous_score: reputation.score,
      delta: -5,
      factors: [{ signal: 'validation', impact: 'negative', message: 'Simulated reputation drop' }]
    }
  });

  policy = await OrgEmailPolicy.findOne({ organizationId }).lean();
  if (policy?.reputationDelta !== -5) {
    throw new Error(`Expected reputationDelta=-5, got ${policy?.reputationDelta}`);
  }
  log('4', 'reputation.updated webhook updated MongoDB');

  const history = await client.getReputationHistory(orgIdStr, 5);
  if (!history || !Array.isArray(history.history)) {
    throw new Error('AMDS reputation history response invalid');
  }
  log('5', `AMDS reputation history entries=${history.history.length}`);

  console.log('\n✅ Track 6 Phase 2 validation passed');
}

main()
  .catch((err) => {
    console.error('\n❌ Track 6 Phase 2 validation failed:', err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  });
