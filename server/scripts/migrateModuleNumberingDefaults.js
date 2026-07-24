#!/usr/bin/env node
'use strict';

/**
 * Seed Module Numbering defaults for existing organizations and
 * initialize ModuleSequence from max existing record numbers.
 *
 * Usage:
 *   node server/scripts/migrateModuleNumberingDefaults.js
 *   node server/scripts/migrateModuleNumberingDefaults.js --org=<organizationId>
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const moduleNumberingService = require('../services/moduleNumberingService');
const { STANDARD_MODULE_KEYS } = require('../constants/moduleNumberingRegistry');

async function migrateOrg(organizationId) {
  const seed = await moduleNumberingService.seedDefaultsForOrg(organizationId);
  const resyncResults = [];
  for (const moduleKey of STANDARD_MODULE_KEYS) {
    try {
      const result = await moduleNumberingService.resyncFromExistingRecords(
        organizationId,
        moduleKey
      );
      resyncResults.push({ moduleKey, ok: true, ...result });
    } catch (err) {
      resyncResults.push({
        moduleKey,
        ok: false,
        message: err.message,
        code: err.code,
      });
    }
  }
  return { seed, resyncResults };
}

async function main() {
  const orgArg = process.argv.find((a) => a.startsWith('--org='));
  const onlyOrg = orgArg ? orgArg.slice('--org='.length) : null;

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI / MONGO_URI required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected');

  const filter = onlyOrg
    ? { _id: onlyOrg, isTenant: { $ne: false } }
    : { $or: [{ isTenant: true }, { isTenant: { $exists: false } }] };

  // Prefer SaaS tenant orgs; Organization model may also hold CRM accounts
  const orgs = await Organization.find(
    onlyOrg ? { _id: onlyOrg } : { parentOrganizationId: { $exists: false } }
  )
    .select('_id name')
    .lean();

  // Fallback: if empty, try without filter
  const targets = orgs.length
    ? orgs
    : await Organization.find(onlyOrg ? { _id: onlyOrg } : {})
        .select('_id name')
        .limit(onlyOrg ? 1 : 500)
        .lean();

  console.log(`Migrating ${targets.length} organization(s)`);

  for (const org of targets) {
    console.log(`\n→ ${org.name || org._id}`);
    try {
      const result = await migrateOrg(org._id);
      console.log(`  seed: +${result.seed.created} / skip ${result.seed.skipped}`);
      const failed = result.resyncResults.filter((r) => !r.ok);
      const skipped = result.resyncResults.filter((r) => r.ok && r.skipped);
      const ok = result.resyncResults.filter((r) => r.ok && !r.skipped);
      console.log(
        `  resync ok: ${ok.length}, deferred (no model): ${skipped.length}, failed: ${failed.length}`
      );
      if (skipped.length) {
        console.log(`    deferred: ${skipped.map((s) => s.moduleKey).join(', ')}`);
      }
      for (const f of failed) {
        console.log(`    ! ${f.moduleKey}: ${f.message}`);
      }
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
    }
  }

  await mongoose.disconnect();
  console.log('\nDone');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
