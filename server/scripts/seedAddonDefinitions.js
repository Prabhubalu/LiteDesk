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

const ARTICLES_ADDON = {
  addonKey: ADDON_KEYS.ARTICLES,
  name: 'Articles',
  description: 'Knowledge base article builder with block editor, portal publishing, and case deflection.',
  icon: 'book-open',
  category: 'COMMUNICATION',
  enabled: true,
  order: 30,
  requiredApps: ['HELPDESK'],
  optionalApps: ['PORTAL', 'SALES'],
  marketplace: {
    category: 'Helpdesk',
    comingSoon: false,
    beta: false,
    shortDescription: 'Build and publish help articles to your customer portal and website.',
    docsUrl: '',
  },
};

const BLOG_ADDON = {
  addonKey: ADDON_KEYS.BLOG,
  name: 'Blog',
  description: 'Marketing blog builder with SEO, categories, RSS, and tenant website publishing.',
  icon: 'newspaper',
  category: 'COMMUNICATION',
  enabled: true,
  order: 40,
  requiredApps: ['MARKETING'],
  optionalApps: ['SALES'],
  marketplace: {
    category: 'Marketing',
    comingSoon: false,
    beta: false,
    shortDescription: 'Publish a branded blog on your website without WordPress.',
    docsUrl: '',
  },
};

const ANNOUNCEMENTS_ADDON = {
  addonKey: ADDON_KEYS.ANNOUNCEMENTS,
  name: 'Announcements & Alerts',
  description: 'Broadcast banners and popovers to users across apps and portals.',
  icon: 'megaphone',
  category: 'COMMUNICATION',
  enabled: true,
  order: 25,
  requiredApps: [],
  optionalApps: ['PORTAL'],
  marketplace: {
    category: 'Communication',
    comingSoon: false,
    beta: true,
    shortDescription: 'Publish banners and popovers to your people — calmly and on time.',
    docsUrl: '',
  },
};

const TELEPHONY_ADDON = {
  addonKey: ADDON_KEYS.TELEPHONY,
  name: 'Telephony',
  description:
    'Provider-agnostic voice calling with softphone, call logging, recordings, queues, IVR, campaigns, and AI insights.',
  icon: 'phone',
  category: 'COMMUNICATION',
  enabled: true,
  order: 15,
  optionalApps: ['SALES', 'HELPDESK', 'PROJECTS', 'PORTAL'],
  marketplace: {
    category: 'Communication',
    comingSoon: false,
    beta: true,
    shortDescription: 'Make and receive calls from the CRM with Twilio and other providers.',
    docsUrl: '',
  },
};

const AI_ADDON = {
  addonKey: ADDON_KEYS.AI,
  name: 'Arivu AI',
  description:
    'Full AI suite for Arivu: assist, commercial, service, and knowledge. One install unlocks everything. Use platform AI credits or bring your own provider key.',
  icon: 'sparkles',
  category: 'INTEGRATION',
  enabled: true,
  order: 50,
  optionalApps: ['SALES', 'HELPDESK', 'MARKETING', 'AUDIT', 'PORTAL'],
  marketplace: {
    category: 'AI',
    comingSoon: false,
    beta: true,
    shortDescription: 'One AI product — draft, summarize, quote assist, cases, and document Q&A.',
    docsUrl: '',
  },
};

const AI_CREDITS_ADDON = {
  addonKey: ADDON_KEYS.AI_CREDITS,
  name: 'AI Credit Packs',
  description:
    'Purchase AI tokens for platform-key usage (Bring Your Own Key does not consume tokens).',
  icon: 'cpu-chip',
  category: 'INTEGRATION',
  enabled: true,
  order: 51,
  optionalApps: ['SALES', 'HELPDESK', 'MARKETING', 'AUDIT', 'PORTAL'],
  marketplace: {
    category: 'AI',
    comingSoon: false,
    beta: true,
    shortDescription: 'Top up AI tokens when using Arivu platform keys.',
    docsUrl: '',
  },
};

const TALLY_ADDON = {
  addonKey: ADDON_KEYS.TALLY,
  name: 'TallyPrime Connector',
  description:
    'Connect TallyPrime via the Arivu Connector Agent. Sync masters, inventory, and commercial vouchers with conflict handling and Integration Center.',
  icon: 'building-library',
  category: 'INTEGRATION',
  enabled: true,
  order: 60,
  optionalApps: ['SALES'],
  marketplace: {
    category: 'Integrations',
    comingSoon: false,
    beta: true,
    shortDescription: 'TallyPrime sync with Windows Agent — masters, stock, and vouchers.',
    docsUrl: '',
  },
};

const STOCKROOM_ADDON = {
  addonKey: ADDON_KEYS.STOCKROOM,
  name: 'Stockroom',
  description:
    'Multi-location stockrooms for warehouse operations: primary location bootstrap, balances per stockroom, transfers, and fulfillment routing.',
  icon: 'building-storefront',
  category: 'OTHER',
  enabled: true,
  order: 70,
  requiredApps: ['INVENTORY'],
  optionalApps: [],
  marketplace: {
    category: 'Inventory',
    comingSoon: false,
    beta: true,
    shortDescription: 'Manage multiple stockrooms and location-level inventory.',
    docsUrl: '',
  },
};

const CPQ_ADDON = {
  addonKey: ADDON_KEYS.CPQ,
  name: 'CPQ',
  description:
    '
Configure-price-quote for catalog: item groups, product configurations with rules, variant generation, price books, pricing rules, and promotions.',
  icon: 'squares-plus',
  category: 'OTHER',
  enabled: true,
  order: 71,
  requiredApps: ['INVENTORY'],
  optionalApps: ['SALES'],
  marketplace: {
    category: 'Inventory',
    comingSoon: false,
    beta: true,
    shortDescription: 'Item groups, product configurations, and quote-ready pricing.',
    docsUrl: '',
  },
};

/** Legacy split packages — disabled in catalog; entitlement still accepted via alias. */
const LEGACY_AI_ADDONS_DISABLED = [
  {
    addonKey: ADDON_KEYS.AI_ASSIST,
    name: 'Arivu Assist (legacy)',
    description: 'Superseded by Arivu AI. Kept for entitlement alias only.',
    icon: 'sparkles',
    category: 'INTEGRATION',
    enabled: false,
    order: 900,
    marketplace: { category: 'AI', comingSoon: true, beta: false, shortDescription: '', docsUrl: '' },
  },
  {
    addonKey: ADDON_KEYS.AI_COMMERCIAL,
    name: 'Arivu Commercial AI (legacy)',
    description: 'Superseded by Arivu AI.',
    icon: 'currency-dollar',
    category: 'INTEGRATION',
    enabled: false,
    order: 901,
    marketplace: { category: 'AI', comingSoon: true, beta: false, shortDescription: '', docsUrl: '' },
  },
  {
    addonKey: ADDON_KEYS.AI_SERVICE,
    name: 'Arivu Service AI (legacy)',
    description: 'Superseded by Arivu AI.',
    icon: 'lifebuoy',
    category: 'INTEGRATION',
    enabled: false,
    order: 902,
    marketplace: { category: 'AI', comingSoon: true, beta: false, shortDescription: '', docsUrl: '' },
  },
  {
    addonKey: ADDON_KEYS.AI_KNOWLEDGE,
    name: 'Arivu Knowledge (legacy)',
    description: 'Superseded by Arivu AI.',
    icon: 'book-open',
    category: 'INTEGRATION',
    enabled: false,
    order: 903,
    marketplace: { category: 'AI', comingSoon: true, beta: false, shortDescription: '', docsUrl: '' },
  },
];

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
  const defResultArticles = await upsertAddonDefinition(ARTICLES_ADDON);
  const defResultBlog = await upsertAddonDefinition(BLOG_ADDON);
  const defResultAnnouncements = await upsertAddonDefinition(ANNOUNCEMENTS_ADDON);
  const defResultTelephony = await upsertAddonDefinition(TELEPHONY_ADDON);
  const defResultAi = await upsertAddonDefinition(AI_ADDON);
  const defResultAiCredits = await upsertAddonDefinition(AI_CREDITS_ADDON);
  const defResultTally = await upsertAddonDefinition(TALLY_ADDON);
  const defResultStockroom = await upsertAddonDefinition(STOCKROOM_ADDON);
  const defResultCpq = await upsertAddonDefinition(CPQ_ADDON);
  for (const legacy of LEGACY_AI_ADDONS_DISABLED) {
    // eslint-disable-next-line no-await-in-loop
    await upsertAddonDefinition(legacy);
  }
  const pricingResultLiveChat = await upsertAddonPricing(ADDON_KEYS.LIVE_CHAT);
  const pricingResultEmailCredits = await upsertAddonPricing(ADDON_KEYS.EMAIL_CREDITS);
  const pricingResultArticles = await upsertAddonPricing(ADDON_KEYS.ARTICLES);
  const pricingResultBlog = await upsertAddonPricing(ADDON_KEYS.BLOG);
  const pricingResultAnnouncements = await upsertAddonPricing(ADDON_KEYS.ANNOUNCEMENTS);
  const pricingResultTelephony = await upsertAddonPricing(ADDON_KEYS.TELEPHONY);
  const pricingResultAi = await upsertAddonPricing(ADDON_KEYS.AI);
  const pricingResultAiCredits = await upsertAddonPricing(ADDON_KEYS.AI_CREDITS);
  const pricingResultTally = await upsertAddonPricing(ADDON_KEYS.TALLY);
  const pricingResultStockroom = await upsertAddonPricing(ADDON_KEYS.STOCKROOM);
  const pricingResultCpq = await upsertAddonPricing(ADDON_KEYS.CPQ);

  if (!useExistingConnection) {
    await mongoose.disconnect();
  }

  return {
    defResultLiveChat,
    defResultEmailCredits,
    defResultArticles,
    defResultBlog,
    defResultAnnouncements,
    defResultTelephony,
    defResultAi,
    defResultAiCredits,
    defResultTally,
    defResultStockroom,
    defResultCpq,
    pricingResultLiveChat,
    pricingResultEmailCredits,
    pricingResultArticles,
    pricingResultBlog,
    pricingResultAnnouncements,
    pricingResultTelephony,
    pricingResultAi,
    pricingResultAiCredits,
    pricingResultTally,
    pricingResultStockroom,
    pricingResultCpq,
  };
}

async function main() {
  const result = await ensureAddonCatalogSeeded();
  console.log(`AddonDefinition live_chat: ${result.defResultLiveChat}`);
  console.log(`AddonDefinition email_credits: ${result.defResultEmailCredits}`);
  console.log(`AddonDefinition articles: ${result.defResultArticles}`);
  console.log(`AddonDefinition blog: ${result.defResultBlog}`);
  console.log(`AddonDefinition announcements: ${result.defResultAnnouncements}`);
  console.log(`AddonDefinition telephony: ${result.defResultTelephony}`);
  console.log(`AddonDefinition ai: ${result.defResultAi}`);
  console.log(`AddonDefinition ai_credits: ${result.defResultAiCredits}`);
  console.log(`AddonDefinition tally: ${result.defResultTally}`);
  console.log(`AddonDefinition stockroom: ${result.defResultStockroom}`);
  console.log(`AddonDefinition cpq: ${result.defResultCpq}`);
  console.log(`AddonPricingDefinition live_chat: ${result.pricingResultLiveChat}`);
  console.log(`AddonPricingDefinition email_credits: ${result.pricingResultEmailCredits}`);
  console.log(`AddonPricingDefinition articles: ${result.pricingResultArticles}`);
  console.log(`AddonPricingDefinition blog: ${result.pricingResultBlog}`);
  console.log(`AddonPricingDefinition announcements: ${result.pricingResultAnnouncements}`);
  console.log(`AddonPricingDefinition telephony: ${result.pricingResultTelephony}`);
  console.log(`AddonPricingDefinition ai: ${result.pricingResultAi}`);
  console.log(`AddonPricingDefinition ai_credits: ${result.pricingResultAiCredits}`);
  console.log(`AddonPricingDefinition tally: ${result.pricingResultTally}`);
  console.log(`AddonPricingDefinition stockroom: ${result.pricingResultStockroom}`);
  console.log(`AddonPricingDefinition cpq: ${result.pricingResultCpq}`);
  console.log('Done.');
}

module.exports = {
  ensureAddonCatalogSeeded,
  LIVE_CHAT_ADDON,
  EMAIL_CREDITS_ADDON,
  ARTICLES_ADDON,
  BLOG_ADDON,
  ANNOUNCEMENTS_ADDON,
  TELEPHONY_ADDON,
  AI_ADDON,
  AI_CREDITS_ADDON,
  TALLY_ADDON,
  STOCKROOM_ADDON,
  CPQ_ADDON,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
