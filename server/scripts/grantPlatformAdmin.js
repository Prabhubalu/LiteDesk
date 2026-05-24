#!/usr/bin/env node
/**
 * Grant isPlatformAdmin on an existing user (for Control Plane / inbound parser UI).
 *
 * Usage:
 *   node scripts/grantPlatformAdmin.js hello@arivusystems.com
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { getMongoUris, connectMasterWithRetry } = require('../lib/mongoConnect');
const User = require('../models/User');

async function main() {
  const email = String(process.argv[2] || process.env.DEFAULT_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!email) {
    console.error('Usage: node scripts/grantPlatformAdmin.js <email>');
    process.exit(1);
  }

  const { masterUri } = getMongoUris();
  await connectMasterWithRetry(masterUri);

  const user = await User.findOne({ email });
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  user.isPlatformAdmin = true;
  await user.save();

  console.log(`✅ isPlatformAdmin=true for ${email} (${user._id})`);
  console.log('   Log out and log back in (or hard refresh) so the browser picks up the flag.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
