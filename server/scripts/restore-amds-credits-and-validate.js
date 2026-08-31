'use strict';

/**
 * Restore org email credits (MongoDB + AMDS) and run AMDS E2E validation scripts.
 *
 * Use after validate-amds-track6-phase1.js — that script sets credits_remaining to 0.
 *
 * Prerequisites:
 *   - AMDS running (default http://localhost:8080)
 *   - Arivu API running (default http://localhost:3000)
 *   - server/.env with MONGO_URI, AMDS_BASE_URL, AMDS_API_KEY
 *
 * Usage:
 *   node scripts/restore-amds-credits-and-validate.js
 *   node scripts/restore-amds-credits-and-validate.js [organizationId]
 *   node scripts/restore-amds-credits-and-validate.js [organizationId] --credits 50000
 *   node scripts/restore-amds-credits-and-validate.js --restore-only
 *   node scripts/restore-amds-credits-and-validate.js --include-phase1
 *
 * Options:
 *   --credits N          Credits to allocate (default: 50000, or AMDS_RESTORE_CREDITS env)
 *   --restore-only       Restore + verify only; skip validation scripts
 *   --include-phase1     Run track6 phase1 last (will zero credits again)
 *   --keep-warmup        Do not disable warmup_enabled before send tests
 *   --skip-track3        Skip validate-amds-track3-bounce.js
 *   --skip-track4        Skip validate-amds-track4-campaign.js
 *   --skip-track6        Skip validate-amds-track6-phase{2,3}.js
 *
 * Warmup note: AMDS day_1 warmup can throttle effective_burst_rate to ~5/min and cause 429
 * on campaign sends. By default this script sets warmup_enabled=false before send tests.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const mongoose = require('mongoose');
const axios = require('axios');
const Organization = require('../models/Organization');
const OrgEmailPolicy = require('../models/org-email-policy');
const { isAmdsEnvConfigured, getAmdsClient } = require('../config/amds');
const {
  allocateOrgCredits,
  syncOrgPolicyToAmds
} = require('../services/amds/amds-policy-sync');
const { getEmailPolicyDefaultsForPlan } = require('../constants/emailPolicyDefaults');

const SCRIPTS_DIR = __dirname;
const DEFAULT_CREDITS = Number(process.env.AMDS_RESTORE_CREDITS) || 50_000;
const RATE_LIMIT_RETRY_WAIT_MS = Number(process.env.AMDS_RATE_LIMIT_RETRY_WAIT_MS) || 65_000;
const RATE_LIMIT_MAX_RETRIES = Number(process.env.AMDS_RATE_LIMIT_MAX_RETRIES) || 2;
const AMDS_HEALTH_URL = String(process.env.AMDS_BASE_URL || 'http://localhost:8080').replace(/\/$/, '') + '/health';
const ARIVU_WEBHOOK_HEALTH = String(
  process.env.ARIVU_API_URL ||
    `http://127.0.0.1:${process.env.PORT || 3000}`
).replace(/\/$/, '') + '/api/internal/webhooks/amds/health';

function log(step, message) {
  console.log(`[restore-validate] ${step}: ${message}`);
}

function parseArgs(argv) {
  const flags = new Set();
  const positional = [];
  let credits = DEFAULT_CREDITS;

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--restore-only') flags.add('restore-only');
    else if (arg === '--include-phase1') flags.add('include-phase1');
    else if (arg === '--keep-warmup') flags.add('keep-warmup');
    else if (arg === '--skip-track3') flags.add('skip-track3');
    else if (arg === '--skip-track4') flags.add('skip-track4');
    else if (arg === '--skip-track6') flags.add('skip-track6');
    else if (arg === '--credits') {
      credits = Number(argv[++i]);
      if (!Number.isFinite(credits) || credits <= 0) {
        throw new Error('--credits must be a positive number');
      }
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  return { orgId: positional[0] || null, credits, flags };
}

async function resolveOrganizationId(argvOrgId) {
  if (argvOrgId && mongoose.Types.ObjectId.isValid(argvOrgId)) {
    return new mongoose.Types.ObjectId(argvOrgId);
  }
  const org = await Organization.findOne().select('_id name').lean();
  if (!org?._id) {
    throw new Error('No organization found — pass organizationId as the first argument');
  }
  log('org', `Using ${org._id}${org.name ? ` (${org.name})` : ''}`);
  return org._id;
}

async function assertServicesUp() {
  try {
    const amds = await axios.get(AMDS_HEALTH_URL, { timeout: 5000, validateStatus: () => true });
    if (amds.status < 200 || amds.status >= 300) {
      throw new Error(`AMDS health returned HTTP ${amds.status} at ${AMDS_HEALTH_URL}`);
    }
    log('health', `AMDS OK (${AMDS_HEALTH_URL})`);
  } catch (err) {
    throw new Error(
      `AMDS is not reachable at ${AMDS_HEALTH_URL} — start AMDS first (${err.message || err})`
    );
  }

  try {
    const wh = await axios.get(ARIVU_WEBHOOK_HEALTH, { timeout: 5000, validateStatus: () => true });
    if (wh.status < 200 || wh.status >= 300) {
      throw new Error(`Arivu webhook health returned HTTP ${wh.status}`);
    }
    if (!wh.data?.configured) {
      throw new Error('Arivu AMDS client not configured (check AMDS_BASE_URL / AMDS_API_KEY in server/.env)');
    }
    log('health', `Arivu webhook OK (${ARIVU_WEBHOOK_HEALTH})`);
  } catch (err) {
    throw new Error(
      `Arivu API is not reachable — start Arivu server first (${err.message || err})`
    );
  }
}

async function restoreCredits(organizationId, amount) {
  const orgIdStr = String(organizationId);
  const before = await OrgEmailPolicy.findOne({ organizationId }).lean();
  log('restore', `Current creditsRemaining=${before?.creditsRemaining ?? 'none'} → allocating +${amount}`);

  const doc = await allocateOrgCredits(organizationId, amount, 'restore_amds_credits_and_validate');
  log('restore', `MongoDB creditsRemaining=${doc.creditsRemaining}`);

  const client = getAmdsClient();
  if (!client) {
    throw new Error('AMDS client unavailable after restore');
  }

  const remote = await client.getTenantPolicy(orgIdStr);
  if (remote.credits_remaining !== doc.creditsRemaining) {
    throw new Error(
      `AMDS credits mismatch after restore: local=${doc.creditsRemaining} remote=${remote.credits_remaining}`
    );
  }
  log('restore', `AMDS credits_remaining=${remote.credits_remaining} (in sync)`);

  return doc;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Disable warmup + ensure enterprise-scale limits so dev validation is not throttled to ~5/min burst.
 * @param {import('mongoose').Types.ObjectId} organizationId
 * @returns {Promise<{ previousWarmupEnabled: boolean }>}
 */
async function prepareDevValidationPolicy(organizationId) {
  const enterprise = getEmailPolicyDefaultsForPlan('ENTERPRISE');
  const existing = await OrgEmailPolicy.findOne({ organizationId });
  if (!existing) {
    throw new Error(`OrgEmailPolicy not found for ${organizationId}`);
  }

  const previousWarmupEnabled = existing.warmupEnabled !== false;

  await OrgEmailPolicy.findOneAndUpdate(
    { organizationId },
    {
      $set: {
        status: 'active',
        warmupEnabled: false,
        dailySendLimit: enterprise.dailySendLimit,
        maxHourlyRate: enterprise.maxHourlyRate,
        burstRatePerMin: enterprise.burstRatePerMin,
        maxCampaignSize: enterprise.maxCampaignSize
      }
    }
  );

  await syncOrgPolicyToAmds(organizationId);

  const client = getAmdsClient();
  if (client) {
    const throughput = await client.getTenantThroughput(String(organizationId));
    log(
      'limits',
      `warmup_enabled=false synced; effective_burst_rate=${throughput.effective_burst_rate}, effective_hourly_rate=${throughput.effective_hourly_rate}`
    );
  } else {
    log('limits', 'warmup_enabled=false synced (throughput poll skipped)');
  }

  return { previousWarmupEnabled };
}

/**
 * @param {import('mongoose').Types.ObjectId} organizationId
 * @param {boolean} previousWarmupEnabled
 */
async function restoreWarmupSetting(organizationId, previousWarmupEnabled) {
  if (!previousWarmupEnabled) return;

  await OrgEmailPolicy.findOneAndUpdate(
    { organizationId },
    { $set: { warmupEnabled: true } }
  );
  await syncOrgPolicyToAmds(organizationId);
  log('limits', 'restored warmup_enabled=true');
}

function isRateLimitScriptFailure(result) {
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  return (
    output.includes('Sending limit reached')
    || output.includes('AMDS_RATE_LIMIT_EXCEEDED')
    || output.includes('rate_limit_exceeded')
    || output.includes('burst_limit_exceeded')
    || output.includes('hourly_limit_exceeded')
    || output.includes('daily_limit_exceeded')
  );
}

function runValidationScriptOnce(scriptName, organizationId) {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  return spawnSync(process.execPath, [scriptPath, String(organizationId)], {
    cwd: path.join(SCRIPTS_DIR, '..'),
    env: process.env,
    encoding: 'utf8'
  });
}

async function runValidationScript(scriptName, organizationId) {
  log('run', scriptName);

  let lastResult = runValidationScriptOnce(scriptName, organizationId);
  if (lastResult.stdout) process.stdout.write(lastResult.stdout);
  if (lastResult.stderr) process.stderr.write(lastResult.stderr);

  let attempt = 0;
  while (lastResult.status !== 0 && isRateLimitScriptFailure(lastResult) && attempt < RATE_LIMIT_MAX_RETRIES) {
    attempt += 1;
    log(
      'retry',
      `${scriptName} hit rate limit — waiting ${Math.round(RATE_LIMIT_RETRY_WAIT_MS / 1000)}s (attempt ${attempt}/${RATE_LIMIT_MAX_RETRIES})`
    );
    await sleep(RATE_LIMIT_RETRY_WAIT_MS);
    lastResult = runValidationScriptOnce(scriptName, organizationId);
    if (lastResult.stdout) process.stdout.write(lastResult.stdout);
    if (lastResult.stderr) process.stderr.write(lastResult.stderr);
  }

  if (lastResult.status !== 0) {
    throw new Error(`${scriptName} failed with exit code ${lastResult.status ?? 'unknown'}`);
  }
}

async function main() {
  if (!isAmdsEnvConfigured()) {
    throw new Error('AMDS env is not configured (AMDS_BASE_URL, AMDS_API_KEY in server/.env)');
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI or MONGODB_URI is required in server/.env');
  }

  const { orgId: argvOrgId, credits, flags } = parseArgs(process.argv);

  await assertServicesUp();
  await mongoose.connect(mongoUri);

  const organizationId = await resolveOrganizationId(argvOrgId);
  await restoreCredits(organizationId, credits);

  if (flags.has('restore-only')) {
    console.log('\n✅ Credits restored (validation skipped — --restore-only)');
    return;
  }

  /** @type {string[]} */
  const scripts = [];

  if (!flags.has('skip-track6')) {
    scripts.push('validate-amds-track6-phase2.js');
    scripts.push('validate-amds-track6-phase3.js');
  }
  if (!flags.has('skip-track3')) {
    scripts.push('validate-amds-track3-bounce.js');
  }
  if (!flags.has('skip-track4')) {
    scripts.push('validate-amds-track4-campaign.js');
  }
  if (flags.has('include-phase1')) {
    scripts.push('validate-amds-track6-phase1.js');
  }

  if (scripts.length === 0) {
    console.log('\n✅ Credits restored (all validation scripts skipped by flags)');
    return;
  }

  /** @type {{ previousWarmupEnabled: boolean }|null} */
  let warmupSnapshot = null;
  const runsSendTests = scripts.some((name) => name.includes('track3') || name.includes('track4'));
  if (runsSendTests && !flags.has('keep-warmup')) {
    warmupSnapshot = await prepareDevValidationPolicy(organizationId);
  }

  log('plan', `Running ${scripts.length} script(s): ${scripts.join(', ')}`);

  try {
    for (const script of scripts) {
      await runValidationScript(script, organizationId);
    }
  } finally {
    if (warmupSnapshot?.previousWarmupEnabled) {
      await restoreWarmupSetting(organizationId, true);
    }
  }

  const after = await OrgEmailPolicy.findOne({ organizationId }).select('creditsRemaining').lean();
  console.log(`\n✅ Restore + validation complete (creditsRemaining=${after?.creditsRemaining ?? 'unknown'})`);

  if (flags.has('include-phase1')) {
    console.log(
      'Note: track6 phase1 zeros credits at the end. Run this script again before Track 3/4 tests.'
    );
  } else if (!flags.has('skip-track4') || !flags.has('skip-track3')) {
    console.log('Tip: run with --include-phase1 to also validate policy sync + 402 handling (zeros credits).');
  }
}

main()
  .catch((err) => {
    console.error(`\n❌ ${err.message || err}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  });
