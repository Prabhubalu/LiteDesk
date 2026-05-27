#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Migrate helpdeskExecution.channelRules → TenantMailroomConfig policies (dedup + caseLink defaults).
 *
 * Default: dry-run (no writes).
 *   node scripts/migrateHelpdeskChannelRulesToMailroom.js
 *   node scripts/migrateHelpdeskChannelRulesToMailroom.js --apply
 *   node scripts/migrateHelpdeskChannelRulesToMailroom.js --org-id <mongoId> --apply
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const TenantAppConfiguration = require('../models/TenantAppConfiguration');
const TenantMailroomConfig = require('../models/TenantMailroomConfig');
const { buildMigrationPlan } = require('../platform/mailroom/migration/channelRulesMapper');

function resolveMongoUri() {
  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.MONGO_URI_LOCAL ||
    process.env.MONGO_URI_ATLAS;
  if (!mongoUri) {
    console.error('Missing MONGO_URI / MONGODB_URI in server/.env');
    process.exit(1);
  }
  return mongoUri;
}

function parseArgs(argv) {
  const out = { apply: false, orgId: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') out.apply = true;
    else if (a === '--org-id') out.orgId = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function printHelp() {
  console.log(`
Migrate Helpdesk channelRules → Mailroom policies (dedup.onDuplicate, caseLink.defaults).

  node scripts/migrateHelpdeskChannelRulesToMailroom.js [--apply] [--org-id <id>]

Options:
  --apply       Persist TenantMailroomConfig updates
  --org-id      Limit to one organization
`);
}

async function loadHelpdeskConfigs(orgId) {
  const query = { appKey: 'HELPDESK' };
  if (orgId) query.organizationId = new mongoose.Types.ObjectId(orgId);
  return TenantAppConfiguration.find(query).select('organizationId settings').lean();
}

async function migrateOrganization(organizationId, { apply }) {
  const helpdesk = await TenantAppConfiguration.findOne({
    organizationId,
    appKey: 'HELPDESK'
  })
    .select('settings')
    .lean();

  const channelRules =
    helpdesk?.settings?.helpdeskExecution?.channelRules
    || helpdesk?.settings?.channelRules
    || {};

  const mailroomRow = await TenantMailroomConfig.findOne({ organizationId }).lean();
  const plan = buildMigrationPlan({ channelRules, mailroomRow });

  if (plan.skipped) {
    return { organizationId, status: 'skipped', reason: plan.reason };
  }

  const summary = {
    organizationId,
    status: apply ? 'applied' : 'dry_run',
    channel: plan.channel,
    dedupOnDuplicate: plan.patch.dedup.onDuplicate,
    caseLinkDefaults: plan.patch.caseLink.defaults || {},
    activeTemplateId: plan.activeTemplateId
  };

  if (apply) {
    const { getDefaultMailroomConfig } = require('../platform/mailroom/policies/templates/defaultTemplates');
    const defaults = getDefaultMailroomConfig();
    await TenantMailroomConfig.findOneAndUpdate(
      { organizationId },
      {
        $set: {
          organizationId,
          policies: plan.policies,
          activeTemplateId: plan.activeTemplateId,
          schemaVersion: mailroomRow?.schemaVersion || defaults.schemaVersion,
          enabled: mailroomRow?.enabled === true,
          connectors: mailroomRow?.connectors || defaults.connectors
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  return summary;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  await mongoose.connect(resolveMongoUri());
  console.log(`Mailroom channel-rules migration (${args.apply ? 'APPLY' : 'DRY-RUN'})`);

  const configs = await loadHelpdeskConfigs(args.orgId);
  const orgIds = [...new Set(configs.map((c) => String(c.organizationId)))];

  let migrated = 0;
  let skipped = 0;

  for (const orgId of orgIds) {
    // eslint-disable-next-line no-await-in-loop
    const result = await migrateOrganization(orgId, { apply: args.apply });
    if (result.status === 'skipped') {
      skipped += 1;
      console.log(`  skip ${orgId}: ${result.reason}`);
    } else {
      migrated += 1;
      console.log(
        `  ${args.apply ? 'ok' : 'plan'} ${orgId} [${result.channel}] dedup=${result.dedupOnDuplicate}`,
        result.caseLinkDefaults && Object.keys(result.caseLinkDefaults).length
          ? `defaults=${JSON.stringify(result.caseLinkDefaults)}`
          : ''
      );
    }
  }

  console.log(`\nDone: ${migrated} migrated, ${skipped} skipped, ${orgIds.length} org(s) scanned`);
  if (!args.apply && migrated > 0) {
    console.log('Re-run with --apply to persist changes.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
