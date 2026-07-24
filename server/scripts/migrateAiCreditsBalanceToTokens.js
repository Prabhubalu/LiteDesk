'use strict';

/**
 * One-time: convert AI ledger from legacy credits (1 ≈ 1k tokens) to raw tokens.
 * Also scales historical AiAuditLog.creditsDebited for migrated orgs.
 *
 * Usage: node server/scripts/migrateAiCreditsBalanceToTokens.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const AddonPricingDefinition = require('../models/AddonPricingDefinition');
const AiAuditLog = require('../models/AiAuditLog');
const { normalizeAiTokenPacks } = require('../constants/aiCreditPackConstants');
const { ADDON_KEYS } = require('../constants/addonKeys');

async function migrate() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGODB_URI required');
  }
  await mongoose.connect(uri);

  const orgs = await Organization.find({
    'aiSettings.credits.balance': { $exists: true },
    $or: [
      { 'aiSettings.credits.ledgerUnit': { $exists: false } },
      { 'aiSettings.credits.ledgerUnit': null },
      { 'aiSettings.credits.ledgerUnit': 'credits' },
    ],
  }).select('_id aiSettings.credits');

  let orgUpdated = 0;
  const orgIds = [];
  for (const org of orgs) {
    const balance = Math.max(0, Math.floor(Number(org.aiSettings?.credits?.balance || 0)));
    await Organization.updateOne(
      { _id: org._id },
      {
        $set: {
          'aiSettings.credits.balance': balance * 1000,
          'aiSettings.credits.ledgerUnit': 'tokens',
        },
      },
    );
    orgUpdated += 1;
    orgIds.push(org._id);
  }

  let auditUpdated = 0;
  if (orgIds.length) {
    const result = await AiAuditLog.updateMany(
      { organizationId: { $in: orgIds }, creditsDebited: { $gt: 0 } },
      [{ $set: { creditsDebited: { $multiply: ['$creditsDebited', 1000] } } }],
    );
    auditUpdated = result.modifiedCount || 0;
  }

  const pricing = await AddonPricingDefinition.findOne({ addonKey: ADDON_KEYS.AI_CREDITS }).lean();
  let packsUpdated = false;
  if (pricing && Array.isArray(pricing.creditPacks) && pricing.creditPacks.length) {
    const packs = normalizeAiTokenPacks(pricing.creditPacks);
    await AddonPricingDefinition.updateOne(
      { addonKey: ADDON_KEYS.AI_CREDITS },
      { $set: { creditPacks: packs } },
    );
    packsUpdated = true;
  }

  console.log(JSON.stringify({ orgUpdated, auditUpdated, packsUpdated }, null, 2));
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
