/**
 * Seed platform addon catalog + default master pricing (master DB: arivu_master).
 *
 * Usage: node server/scripts/seedAddonDefinitions.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const AddonDefinition = require('../models/AddonDefinition');
const AddonPricingDefinition = require('../models/AddonPricingDefinition');
const addonPricingRegistry = require('../constants/addonPricingRegistry');
const { ADDON_KEYS } = require('../constants/addonKeys');
const { getMongoUris } = require('../lib/mongoConnect');

const LIVE_CHAT_ADDON = {
  addonKey: ADDON_KEYS.LIVE_CHAT,
  name: 'Live Chat',
  description: 'Real-time visitor messaging with sessions, queues, and optional app integrations.',
  icon: 'chat-bubble-left-right',
  category: 'COMMUNICATION',
  enabled: true,
  order: 10,
  optionalApps: ['SALES', 'HELPDESK', 'PROJECTS', 'PORTAL'],
  marketplace: {
    category: 'Communication',
    comingSoon: false,
    beta: true,
    shortDescription: 'Engage website visitors through real-time chat.',
    docsUrl: '',
  },
};

const EMAIL_CREDITS_ADDON = {
  addonKey: ADDON_KEYS.EMAIL_CREDITS,
  name: 'Email Credit Packs',
  description: 'Purchase additional outbound email credits for campaigns and transactional sends via AMDS.',
  icon: 'envelope',
  category: 'COMMUNICATION',
  enabled: true,
  order: 20,
  optionalApps: ['SALES', 'HELPDESK', 'MARKETING'],
  marketplace: {
    category: 'Communication',
    comingSoon: false,
    beta: false,
    shortDescription: 'Top up email credits when you need more sending capacity.',
    docsUrl: '',
  },
};

async function upsertAddonDefinition(doc) {
  const existing = await AddonDefinition.findOne({ addonKey: doc.addonKey });
  if (existing) {
    Object.assign(existing, doc);
    await existing.save();
    return 'updated';
  }
  await AddonDefinition.create(doc);
  return 'created';
}

async function upsertAddonPricing(addonKey) {
  const fallback = addonPricingRegistry[addonKey];
  if (!fallback) return 'skipped';

  const payload = {
    addonKey,
    billingType: fallback.billingType,
    defaultPlan: fallback.defaultPlan,
    trialDays: fallback.trialDays,
    plans: fallback.plans,
    enabled: true,
  };

  if (Array.isArray(fallback.creditPacks) && fallback.creditPacks.length > 0) {
    payload.creditPacks = fallback.creditPacks;
  }

  const existing = await AddonPricingDefinition.findOne({ addonKey });
  if (existing) {
    existing.billingType = payload.billingType;
    existing.defaultPlan = payload.defaultPlan;
    existing.trialDays = payload.trialDays;
    existing.plans = payload.plans;
    if (payload.creditPacks) existing.creditPacks = payload.creditPacks;
    existing.enabled = true;
    await existing.save();
    return 'updated';
  }

  await AddonPricingDefinition.create(payload);
  return 'created';
}

/**
 * Idempotent seed for AddonDefinition + AddonPricingDefinition in the master catalog DB.
 * @param {{ useExistingConnection?: boolean }} options
 */
async function ensureAddonCatalogSeeded(options = {}) {
  const { useExistingConnection = false } = options;

  if (!useExistingConnection) {
    const { masterUri, masterDbName } = getMongoUris();
    await mongoose.connect(masterUri);
    console.log(`Connected to MongoDB (${masterDbName})`);
  }

  const defResultLiveChat = await upsertAddonDefinition(LIVE_CHAT_ADDON);
  const defResultEmailCredits = await upsertAddonDefinition(EMAIL_CREDITS_ADDON);
  const pricingResultLiveChat = await upsertAddonPricing(ADDON_KEYS.LIVE_CHAT);
  const pricingResultEmailCredits = await upsertAddonPricing(ADDON_KEYS.EMAIL_CREDITS);

  if (!useExistingConnection) {
    await mongoose.disconnect();
  }

  return {
    defResultLiveChat,
    defResultEmailCredits,
    pricingResultLiveChat,
    pricingResultEmailCredits
  };
}

async function main() {
  const result = await ensureAddonCatalogSeeded();
  console.log(`AddonDefinition live_chat: ${result.defResultLiveChat}`);
  console.log(`AddonDefinition email_credits: ${result.defResultEmailCredits}`);
  console.log(`AddonPricingDefinition live_chat: ${result.pricingResultLiveChat}`);
  console.log(`AddonPricingDefinition email_credits: ${result.pricingResultEmailCredits}`);
  console.log('Done.');
}

module.exports = { ensureAddonCatalogSeeded, LIVE_CHAT_ADDON, EMAIL_CREDITS_ADDON };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
