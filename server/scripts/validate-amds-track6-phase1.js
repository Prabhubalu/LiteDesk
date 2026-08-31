'use strict';

/**
 * End-to-end Track 6 Phase 1 tenant policy validation (Arivu + AMDS must be running).
 *
 * Usage:
 *   node scripts/validate-amds-track6-phase1.js [organizationId]
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const OrgEmailPolicy = require('../models/org-email-policy');
const { getAmdsClient, isAmdsEnvConfigured } = require('../config/amds');
const { ensureOrgEmailPolicy } = require('../services/orgEmailPolicyService');
const { syncOrgPolicyToAmds, toAmdsPolicy } = require('../services/amds/amds-policy-sync');
const { sendViaAmds } = require('../services/emailProviders/amdsEmailDelivery');
const { writeMetadata } = require('../utils/arivuMetadata');

function log(step, message) {
  console.log(`[track6-phase1] ${step}: ${message}`);
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
  const policyDoc = await OrgEmailPolicy.findOne({ organizationId });
  if (!policyDoc) throw new Error('OrgEmailPolicy not created');

  log('2', `MongoDB policy credits=${policyDoc.creditsRemaining}`);

  const synced = await syncOrgPolicyToAmds(organizationId);
  if (!synced) throw new Error('syncOrgPolicyToAmds returned null');

  const client = getAmdsClient();
  if (!client) throw new Error('AMDS client unavailable');

  const remote = await client.getTenantPolicy(orgIdStr);
  if (remote.credits_remaining !== policyDoc.creditsRemaining) {
    throw new Error(
      `AMDS credits mismatch: local=${policyDoc.creditsRemaining} remote=${remote.credits_remaining}`
    );
  }
  log('3', 'AMDS GET policy matches MongoDB credits');

  const payload = toAmdsPolicy(policyDoc);
  if (payload.monthly_credits !== remote.monthly_credits) {
    throw new Error('monthly_credits mismatch after sync');
  }
  log('4', 'Policy payload fields match AMDS');

  const sendResult = await sendViaAmds({
    organizationId: orgIdStr,
    from: process.env.TRACK6_TEST_FROM || 'noreply@localhost.test',
    to: process.env.TRACK6_TEST_TO || 'test@example.com',
    subject: `[Track6] policy test ${Date.now()}`,
    text: 'Track 6 Phase 1 validation send',
    idempotencyKey: `track6-phase1-${Date.now()}`,
    metadata: { ...writeMetadata({ module: 'crm' }), validation: 'track6-phase1' }
  });

  if (sendResult.success) {
    log('5', `Send queued messageId=${sendResult.messageId}`);
  } else if (sendResult.code === 'AMDS_INSUFFICIENT_CREDITS') {
    log('5', 'Send blocked with insufficient credits (expected when credits=0)');
  } else {
    log('5', `Send result: ${sendResult.error || 'unknown'} (${sendResult.code || 'no-code'})`);
  }

  policyDoc.creditsRemaining = 0;
  await policyDoc.save();
  await syncOrgPolicyToAmds(organizationId);

  const blocked = await sendViaAmds({
    organizationId: orgIdStr,
    from: process.env.TRACK6_TEST_FROM || 'noreply@localhost.test',
    to: process.env.TRACK6_TEST_TO || 'test@example.com',
    subject: `[Track6] zero-credit test ${Date.now()}`,
    text: 'Should fail with 402',
    idempotencyKey: `track6-phase1-zero-${Date.now()}`,
    metadata: { ...writeMetadata({ module: 'crm' }), validation: 'track6-phase1-zero' }
  });

  if (blocked.success) {
    throw new Error('Expected 402 insufficient credits when credits_remaining=0');
  }
  if (blocked.code !== 'AMDS_INSUFFICIENT_CREDITS') {
    throw new Error(`Expected AMDS_INSUFFICIENT_CREDITS, got ${blocked.code || blocked.error}`);
  }
  log('6', '402 insufficient credits confirmed when credits_remaining=0');

  console.log('\n✅ Track 6 Phase 1 validation passed');
}

main()
  .catch((err) => {
    console.error('\n❌ Track 6 Phase 1 validation failed:', err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  });
