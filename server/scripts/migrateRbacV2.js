#!/usr/bin/env node

/**
 * RBAC v2 migration — profiles, legacy role renames, entitlements, user backfill.
 *
 * Usage:
 *   node server/scripts/migrateRbacV2.js [--dry-run] [--org-id=<id>] [--enable-rbac] [--enable-sharing]
 *
 * Idempotent — safe to re-run. Use --dry-run first (Gate E1).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
const { migrateOrganizationRbacV2 } = require('../services/rbacV2MigrationService');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO_URI_LOCAL;

function parseArgs(argv) {
  const args = {
    dryRun: false,
    orgId: null,
    enableRbac: false,
    enableSharing: false
  };

  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--enable-rbac') args.enableRbac = true;
    else if (arg === '--enable-sharing') args.enableSharing = true;
    else if (arg.startsWith('--org-id=')) args.orgId = arg.slice('--org-id='.length).trim();
  }

  return args;
}

function printStats(orgName, orgId, stats) {
  console.log(`\n📦 Organization: ${orgName} (${orgId})`);
  if (stats.skipped) {
    console.log(`   ⏭️  Skipped: ${stats.reason}`);
    return;
  }
  console.log(`   Profiles created: ${stats.profilesCreated} (existing skipped: ${stats.profilesSkipped})`);
  if (stats.rolesRenamed.length) {
    console.log(`   Roles renamed: ${stats.rolesRenamed.map((r) => `${r.from}→${r.to}`).join(', ')}`);
  }
  if (stats.rolesMerged.length) {
    console.log(`   Roles merged: ${stats.rolesMerged.map((r) => `${r.from}→${r.to} (${r.users} users)`).join(', ')}`);
  }
  if (stats.rolesCreated.length) {
    console.log(`   Roles created: ${stats.rolesCreated.join(', ')}`);
  }
  if (stats.rolesDeleted.length) {
    console.log(`   Roles removed: ${stats.rolesDeleted.join(', ')}`);
  }
  console.log(`   Roles updated: ${stats.rolesUpdated}`);
  console.log(`   Users updated: ${stats.usersUpdated}`);
  console.log(`   Users reassigned: ${stats.usersReassigned}`);
  if (stats.hierarchyLevelsRecalculated) console.log('   Hierarchy levels recalculated: yes');
  if (stats.sharingSeeded) console.log('   Sharing defaults seeded: yes');
  if (stats.flagsUpdated) console.log('   Org RBAC/sharing flags enabled: yes');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!MONGO_URI) {
    console.error('❌ MONGODB_URI is not set');
    process.exit(1);
  }

  console.log('🚀 RBAC v2 migration');
  console.log(`   Mode: ${args.dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`);
  if (args.orgId) console.log(`   Scope: org ${args.orgId}`);
  else console.log('   Scope: all tenant organizations');
  if (args.enableRbac) console.log('   Will enable organization.settings.rbacV2Enabled');
  if (args.enableSharing) console.log('   Will enable organization.settings.sharingV1Enabled + seed sharing');

  const [uriWithoutQuery, queryPart] = MONGO_URI.split('?');
  const connectionQuery = queryPart ? `?${queryPart}` : '';
  const baseUri = uriWithoutQuery.split('/').slice(0, -1).join('/');
  const masterDbName = 'arivu_master';
  const masterUri = `${baseUri}/${masterDbName}${connectionQuery}`;

  await mongoose.connect(masterUri);
  await dbConnectionManager.initializeMasterConnection();
  console.log(`✅ Connected to ${masterDbName}\n`);

  const orgQuery = { isTenant: true };
  if (args.orgId) orgQuery._id = args.orgId;

  const organizations = await Organization.find(orgQuery).select('_id name settings').sort({ name: 1 });
  if (!organizations.length) {
    console.log('No matching tenant organizations found.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const totals = {
    processed: 0,
    skipped: 0,
    profilesCreated: 0,
    usersUpdated: 0,
    usersReassigned: 0
  };

  for (const org of organizations) {
    const stats = await runWithOrganizationTenantContext(org._id, () =>
      migrateOrganizationRbacV2(org._id, {
        dryRun: args.dryRun,
        enableRbac: args.enableRbac,
        enableSharing: args.enableSharing,
        logger: (msg) => console.log(`   ${msg}`)
      })
    );

    printStats(org.name, org._id, stats);
    totals.processed += 1;
    if (stats.skipped) totals.skipped += 1;
    totals.profilesCreated += stats.profilesCreated;
    totals.usersUpdated += stats.usersUpdated;
    totals.usersReassigned += stats.usersReassigned;
  }

  console.log('\n✅ Migration complete');
  console.log(`   Organizations processed: ${totals.processed}`);
  console.log(`   Skipped: ${totals.skipped}`);
  console.log(`   Profiles created: ${totals.profilesCreated}`);
  console.log(`   Users updated: ${totals.usersUpdated}`);
  console.log(`   Users reassigned: ${totals.usersReassigned}`);
  if (args.dryRun) {
    console.log('\nℹ️  Dry run only — no database writes were made.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});
