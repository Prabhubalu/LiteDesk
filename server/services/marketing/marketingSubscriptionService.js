'use strict';

const mongoose = require('mongoose');
const MarketingSubscriptionPreference = require('../../models/MarketingSubscriptionPreference');
const Organization = require('../../models/Organization');
const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');
const { getAmdsClient, isAmdsEnvConfigured } = require('../../config/amds');
const {
  createPreferenceToken,
  verifyPreferenceToken,
  buildPreferenceCenterUrl,
  buildUnsubscribeUrl
} = require('../../utils/marketingPreferenceToken');
const { resolveMergeTagsInString } = require('../contentPlatform/engines/mergeTagEngine');

const MARKETING_CATEGORIES = Object.freeze(['marketing', 'newsletter', 'productUpdates']);

/**
 * @param {string} category
 */
function normalizeCategory(category) {
  const key = String(category || 'marketing').trim();
  return MARKETING_CATEGORIES.includes(key) ? key : 'marketing';
}

/**
 * @param {import('mongoose').Document} doc
 */
function serializePreference(doc) {
  if (!doc) return null;
  const value = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    _id: value._id,
    organizationId: value.organizationId,
    personId: value.personId || null,
    email: value.email,
    globalStatus: value.globalStatus || 'subscribed',
    categories: value.categories || {},
    history: Array.isArray(value.history) ? value.history : [],
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  };
}

/**
 * @param {import('mongoose').Document} preference
 * @param {object} entry
 */
async function appendHistory(preference, entry) {
  preference.history = preference.history || [];
  preference.history.unshift({
    action: entry.action,
    category: normalizeCategory(entry.category),
    source: entry.source || 'preference_center',
    campaignId: entry.campaignId || null,
    metadata: entry.metadata || {},
    recordedAt: new Date()
  });
  if (preference.history.length > 100) {
    preference.history = preference.history.slice(0, 100);
  }
}

/**
 * @param {string} organizationId
 * @param {string} email
 * @param {{ personId?: string, source?: string }} [options]
 */
async function getOrCreatePreference(organizationId, email, options = {}) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Email is required');
  }

  return runWithOrganizationTenantContext(organizationId, async () => {
    let preference = await MarketingSubscriptionPreference.findOne({
      organizationId,
      email: normalizedEmail
    });

    if (!preference) {
      const now = new Date();
      preference = await MarketingSubscriptionPreference.create({
        organizationId,
        email: normalizedEmail,
        personId: options.personId && mongoose.Types.ObjectId.isValid(options.personId)
          ? new mongoose.Types.ObjectId(String(options.personId))
          : null,
        globalStatus: 'subscribed',
        categories: {
          marketing: { subscribed: true, updatedAt: now },
          newsletter: { subscribed: true, updatedAt: now },
          productUpdates: { subscribed: true, updatedAt: now }
        },
        history: []
      });

      await appendHistory(preference, {
        action: 'subscribe',
        category: 'marketing',
        source: options.source || 'campaign_send',
        metadata: { initial: true }
      });
      await preference.save();
    } else if (options.personId && !preference.personId && mongoose.Types.ObjectId.isValid(options.personId)) {
      preference.personId = new mongoose.Types.ObjectId(String(options.personId));
      await preference.save();
    }

    return preference;
  });
}

/**
 * @param {string} organizationId
 * @param {string} email
 * @param {string} [category]
 */
async function isEmailSubscribed(organizationId, email, category = 'marketing') {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return false;

  const preference = await runWithOrganizationTenantContext(organizationId, async () =>
    MarketingSubscriptionPreference.findOne({ organizationId, email: normalizedEmail }).lean()
  );

  if (!preference) return true;
  if (preference.globalStatus === 'unsubscribed') return false;

  const catKey = normalizeCategory(category);
  const cat = preference.categories?.[catKey];
  return cat?.subscribed !== false;
}

/**
 * @param {string} organizationId
 * @param {{ email: string, recipientId?: string, mergeData?: object }[]} recipients
 */
async function filterSubscribedRecipients(organizationId, recipients) {
  const { subscribed } = await filterSubscribedRecipientsBulk(organizationId, recipients);
  return subscribed;
}

/**
 * @param {{ email: string, recipientId?: string, mergeData?: object }[]} recipients
 * @param {Map<string, { globalStatus?: string, categories?: object }>} preferenceByEmail
 * @param {string} [category]
 */
function partitionRecipientsBySubscription(recipients, preferenceByEmail, category = 'marketing') {
  const catKey = normalizeCategory(category);
  /** @type {typeof recipients} */
  const subscribed = [];
  /** @type {string[]} */
  const unsubscribedEmails = [];

  for (const recipient of recipients) {
    const email = String(recipient?.email || '').trim().toLowerCase();
    if (!email) continue;

    const preference = preferenceByEmail.get(email);
    if (!preference) {
      subscribed.push({ ...recipient, email });
      continue;
    }
    if (preference.globalStatus === 'unsubscribed') {
      unsubscribedEmails.push(email);
      continue;
    }
    const cat = preference.categories?.[catKey];
    if (cat?.subscribed === false) {
      unsubscribedEmails.push(email);
      continue;
    }
    subscribed.push({ ...recipient, email });
  }

  return { subscribed, unsubscribedEmails };
}

/**
 * @param {string} organizationId
 * @param {{ email: string, recipientId?: string, mergeData?: object }[]} recipients
 * @param {string} [category]
 */
async function filterSubscribedRecipientsBulk(organizationId, recipients, category = 'marketing') {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return { subscribed: [], unsubscribedEmails: [] };
  }

  const normalizedRecipients = recipients
    .map((recipient) => ({
      ...recipient,
      email: String(recipient?.email || '').trim().toLowerCase()
    }))
    .filter((recipient) => recipient.email);

  const emails = [...new Set(normalizedRecipients.map((recipient) => recipient.email))];
  if (emails.length === 0) {
    return { subscribed: [], unsubscribedEmails: [] };
  }

  const preferences = await runWithOrganizationTenantContext(organizationId, async () =>
    MarketingSubscriptionPreference.find({
      organizationId,
      email: { $in: emails }
    })
      .select('email globalStatus categories')
      .lean()
  );

  const preferenceByEmail = new Map(
    preferences.map((preference) => [String(preference.email).toLowerCase(), preference])
  );

  return partitionRecipientsBySubscription(normalizedRecipients, preferenceByEmail, category);
}

/**
 * @param {string} token
 */
async function getPreferenceCenterPayload(token) {
  const claims = verifyPreferenceToken(token);

  return runWithOrganizationTenantContext(claims.organizationId, async () => {
    const [preference, organization] = await Promise.all([
      getOrCreatePreference(claims.organizationId, claims.email, {
        personId: claims.personId,
        source: 'preference_center'
      }),
      Organization.findById(claims.organizationId).select('name settings.branding').lean()
    ]);

    return {
      email: claims.email,
      organizationName: organization?.name || 'LiteDesk',
      globalStatus: preference.globalStatus,
      categories: preference.categories,
      availableCategories: MARKETING_CATEGORIES,
      campaignId: claims.campaignId || null
    };
  });
}

/**
 * @param {string} organizationId
 * @param {string} email
 * @param {object} params
 */
async function syncAmdsSuppression(organizationId, email, params = {}) {
  if (!isAmdsEnvConfigured()) return;
  const client = getAmdsClient();
  if (!client) return;

  try {
    await client.createSuppression({
      tenant_id: String(organizationId),
      email: String(email).trim().toLowerCase(),
      reason: params.reason || 'unsubscribed',
      metadata: params.metadata || {}
    });
  } catch (err) {
    console.warn('[marketingSubscriptionService] AMDS suppression sync failed:', err?.message || err);
  }
}

/**
 * @param {string} token
 * @param {object} body
 * @param {object} [reqMeta]
 */
async function updatePreferencesFromToken(token, body = {}, reqMeta = {}) {
  const claims = verifyPreferenceToken(token);
  const unsubscribeAll = body.unsubscribeAll === true;
  const categoriesInput = body.categories && typeof body.categories === 'object' ? body.categories : {};

  return runWithOrganizationTenantContext(claims.organizationId, async () => {
    const preference = await getOrCreatePreference(claims.organizationId, claims.email, {
      personId: claims.personId,
      source: 'preference_center'
    });
    const now = new Date();

    if (unsubscribeAll) {
      preference.globalStatus = 'unsubscribed';
      for (const category of MARKETING_CATEGORIES) {
        preference.categories[category] = { subscribed: false, updatedAt: now };
      }
      await appendHistory(preference, {
        action: 'unsubscribe',
        category: 'marketing',
        source: body.source || 'unsubscribe_link',
        campaignId: claims.campaignId,
        metadata: reqMeta
      });
      await syncAmdsSuppression(claims.organizationId, claims.email, {
        reason: 'unsubscribed',
        metadata: { source: body.source || 'preference_center', campaignId: claims.campaignId || null }
      });
    } else {
      preference.globalStatus = 'subscribed';
      for (const category of MARKETING_CATEGORIES) {
        if (categoriesInput[category] === undefined) continue;
        const subscribed = categoriesInput[category] !== false;
        preference.categories[category] = { subscribed, updatedAt: now };
        await appendHistory(preference, {
          action: subscribed ? 'subscribe' : 'unsubscribe',
          category,
          source: 'preference_center',
          campaignId: claims.campaignId,
          metadata: reqMeta
        });
      }

      const anySubscribed = MARKETING_CATEGORIES.some(
        (category) => preference.categories?.[category]?.subscribed !== false
      );
      if (!anySubscribed) {
        preference.globalStatus = 'unsubscribed';
        await syncAmdsSuppression(claims.organizationId, claims.email, {
          reason: 'unsubscribed',
          metadata: { source: 'preference_center' }
        });
      }
    }

    await preference.save();
    return serializePreference(preference);
  });
}

/**
 * @param {string} organizationId
 * @param {string} personId
 */
async function listPersonSubscriptionHistory(organizationId, personId) {
  if (!mongoose.Types.ObjectId.isValid(personId)) {
    throw new Error('Invalid person id');
  }

  return runWithOrganizationTenantContext(organizationId, async () => {
    const preference = await MarketingSubscriptionPreference.findOne({
      organizationId,
      personId: new mongoose.Types.ObjectId(String(personId))
    }).lean();

    if (!preference) {
      return { preference: null, history: [] };
    }

    return {
      preference: serializePreference(preference),
      history: (preference.history || []).slice(0, 50)
    };
  });
}

/**
 * @param {object} params
 */
function buildRecipientPreferenceUrls(params) {
  const token = createPreferenceToken({
    organizationId: params.organizationId,
    email: params.email,
    personId: params.personId,
    campaignId: params.campaignId
  });

  return {
    token,
    preferencesUrl: buildPreferenceCenterUrl(token, params.req),
    unsubscribeUrl: buildUnsubscribeUrl(token, params.req)
  };
}

/**
 * @param {string} html
 * @param {{ unsubscribeUrl: string, preferencesUrl?: string, organizationName?: string }} params
 */
function appendMarketingUnsubscribeFooter(html, params) {
  const source = String(html || '');
  if (!params?.unsubscribeUrl) return source;
  if (/unsubscribe/i.test(source)) return source;

  const orgName = params.organizationName ? String(params.organizationName).trim() : '';
  const footer = `
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.5;color:#6b7280;text-align:center;">
  ${orgName ? `<p style="margin:0 0 8px;">You are receiving this email from ${orgName}.</p>` : ''}
  <p style="margin:0;">
    <a href="${params.unsubscribeUrl}" style="color:#4f46e5;text-decoration:underline;">Unsubscribe</a>
    ${params.preferencesUrl ? ` · <a href="${params.preferencesUrl}" style="color:#4f46e5;text-decoration:underline;">Manage preferences</a>` : ''}
  </p>
</div>`;

  if (/<\/body>/i.test(source)) {
    return source.replace(/<\/body>/i, `${footer}</body>`);
  }
  return `${source}${footer}`;
}

/**
 * @param {string} content
 * @param {object} scope
 */
function applyPreferenceMergeTags(content, scope) {
  return resolveMergeTagsInString(String(content || ''), scope, { lenient: true });
}

/**
 * @param {object} params
 */
async function prepareCampaignHtmlForRecipient(params) {
  const urls = buildRecipientPreferenceUrls(params);
  const scope = {
    ...(params.mergeScope || {}),
    unsubscribe_url: urls.unsubscribeUrl,
    preferences_url: urls.preferencesUrl,
    Unsubscribe_url: urls.unsubscribeUrl,
    Preferences_url: urls.preferencesUrl
  };

  let html = applyPreferenceMergeTags(params.html || '', scope);
  html = appendMarketingUnsubscribeFooter(html, {
    unsubscribeUrl: urls.unsubscribeUrl,
    preferencesUrl: urls.preferencesUrl,
    organizationName: params.organizationName
  });

  const text = params.text
    ? applyPreferenceMergeTags(params.text, scope)
    : html.replace(/<[^>]+>/g, ' ');

  return { html, text, urls, scope };
}

module.exports = {
  MARKETING_CATEGORIES,
  getOrCreatePreference,
  isEmailSubscribed,
  filterSubscribedRecipients,
  filterSubscribedRecipientsBulk,
  partitionRecipientsBySubscription,
  getPreferenceCenterPayload,
  updatePreferencesFromToken,
  listPersonSubscriptionHistory,
  buildRecipientPreferenceUrls,
  appendMarketingUnsubscribeFooter,
  applyPreferenceMergeTags,
  prepareCampaignHtmlForRecipient,
  serializePreference,
  verifyPreferenceToken
};
