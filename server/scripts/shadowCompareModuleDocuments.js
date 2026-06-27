/* eslint-disable no-console */
/**
 * Batch shadow parity compare for quotes/invoices (requires Mongo + Puppeteer).
 *
 * Usage:
 *   node scripts/shadowCompareModuleDocuments.js <organizationId> [--module=quotes|invoices|both] [--limit=5]
 *
 * Env:
 *   MONGODB_URI — required (loaded via server dotenv when run from server dir)
 */

require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { compareRecentModuleDocuments } = require('../services/contentPlatform/contentPlatformShadowParityService');

function parseArgs(argv) {
  const organizationId = String(argv[2] || '').trim();
  let moduleArg = 'both';
  let limit = 5;

  for (const arg of argv.slice(3)) {
    if (arg.startsWith('--module=')) moduleArg = arg.slice('--module='.length);
    if (arg.startsWith('--limit=')) limit = Number(arg.slice('--limit='.length));
  }

  const modules =
    moduleArg === 'both'
      ? ['quotes', 'invoices']
      : [String(moduleArg || 'quotes').trim().toLowerCase()];

  return { organizationId, modules, limit };
}

async function main() {
  const { organizationId, modules, limit } = parseArgs(process.argv);

  if (!organizationId) {
    console.error('Usage: node scripts/shadowCompareModuleDocuments.js <organizationId> [--module=quotes|invoices|both] [--limit=5]');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);

  try {
    for (const moduleKey of modules) {
      console.log(`\n=== ${moduleKey} (limit ${limit}) ===`);
      const report = await compareRecentModuleDocuments({
        organizationId,
        moduleKey,
        limit
      });

      console.log(`Compared: ${report.compared}`);
      console.log(`Matched:  ${report.matched}`);
      console.log(`Mismatch: ${report.mismatched}`);
      console.log(`Errors:   ${report.errors}`);

      for (const row of report.results) {
        const status = row.platformError ? 'ERROR' : row.match ? 'MATCH' : 'MISMATCH';
        console.log(
          `  ${status} ${row.recordLabel || row.recordId} legacy=${row.legacyChecksum?.slice(0, 12)} platform=${row.platformChecksum?.slice(0, 12) || 'n/a'}`
        );
        if (row.platformError) console.log(`    ${row.platformError}`);
      }
    }

    console.log('\nShadow parity batch compare complete.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Shadow parity batch compare failed:', error);
  process.exit(1);
});
