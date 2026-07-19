'use strict';

const crypto = require('crypto');
const Organization = require('../../models/Organization');
const ContentCollection = require('../../models/ContentCollection');
const {
  buildArticleApiUrl,
  buildArticleExportUrl,
  buildBlogPostApiUrl,
  buildBlogPostExportUrl,
} = require('./contentPublishingService');
const {
  buildArticleExportPath,
  buildCollectionByIdMap,
  resolveCollectionPathSlugs,
  normalizeArticleSlug,
  buildRefreshPages,
} = require('./headlessStaticExportService');

function signWebhookBody(rawBody, secret) {
  if (!secret) return '';
  return `sha256=${crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;
}

function verifyWebhookSignature(rawBody, secret, header) {
  if (!secret) return true;
  if (!header || !String(header).startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const received = String(header).slice('sha256='.length);
  if (expected.length !== received.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  } catch {
    return false;
  }
}

function resolveAddonKey(document) {
  return String(document?.addonKey || 'articles').trim() || 'articles';
}

function resolveStaticExportPathPrefix(addonKey) {
  return addonKey === 'blog' ? '/blog/' : '/help/';
}

async function resolveWebhookStaticExportFields(organizationId, document, organization) {
  const addonKey = resolveAddonKey(document);
  if (addonKey !== 'articles' && addonKey !== 'blog') {
    return {
      updatedAt: document.updatedAt || null,
      exportUrl: '',
      exportPath: '',
      collectionPath: [],
      refreshPages: [],
    };
  }

  const pathPrefix = resolveStaticExportPathPrefix(addonKey);
  const collections = await ContentCollection.find({
    organizationId,
    addonKey,
    deletedAt: null,
  })
    .select('_id slug parentId')
    .lean();
  const collectionById = buildCollectionByIdMap(collections);
  const collectionPath = resolveCollectionPathSlugs(document.collectionId, collectionById);
  const slug = normalizeArticleSlug(document.slug);
  const exportUrl = addonKey === 'blog'
    ? buildBlogPostExportUrl(organization, slug)
    : buildArticleExportUrl(organization, slug);

  return {
    updatedAt: document.updatedAt || null,
    exportUrl,
    exportPath: buildArticleExportPath({
      slug,
      collectionPathSlugs: collectionPath,
      pathPrefix,
    }),
    collectionPath,
    refreshPages: buildRefreshPages(collectionPath, pathPrefix),
  };
}

function resolveContentApiUrl(organization, document) {
  const slug = normalizeArticleSlug(document.slug);
  const addonKey = resolveAddonKey(document);
  if (addonKey === 'blog') {
    return buildBlogPostApiUrl(organization, slug);
  }
  return buildArticleApiUrl(organization, slug);
}

function buildWebhookPayload({
  event,
  organization,
  document,
  staticExport = null,
  test = false,
}) {
  const slug = normalizeArticleSlug(document.slug);
  const addonKey = resolveAddonKey(document);
  const apiUrl = resolveContentApiUrl(organization, document);
  const publicUrl = String(document?.seo?.canonicalUrl || document?.publicUrl || '').trim();
  const pathPrefix = resolveStaticExportPathPrefix(addonKey);
  const exportFields = staticExport || {
    updatedAt: document.updatedAt || null,
    exportUrl: addonKey === 'blog'
      ? buildBlogPostExportUrl(organization, slug)
      : addonKey === 'articles'
        ? buildArticleExportUrl(organization, slug)
        : '',
    exportPath: (addonKey === 'articles' || addonKey === 'blog')
      ? buildArticleExportPath({ slug, collectionPathSlugs: [], pathPrefix })
      : '',
    collectionPath: [],
    refreshPages: (addonKey === 'articles' || addonKey === 'blog')
      ? buildRefreshPages([], pathPrefix)
      : [],
  };

  const payload = {
    event,
    occurredAt: new Date().toISOString(),
    organization: { slug: organization.slug },
    content: {
      id: String(document._id || document.id || ''),
      addonKey,
      contentType: document.contentType || (addonKey === 'blog' ? 'blog_post' : 'knowledge_article'),
      slug,
      title: document.title,
      publishedAt: document.publishedAt || null,
      updatedAt: exportFields.updatedAt || null,
      apiUrl,
      exportUrl: exportFields.exportUrl || '',
      exportPath: exportFields.exportPath || '',
      collectionPath: exportFields.collectionPath || [],
      refreshPages: exportFields.refreshPages || [],
      publicUrl,
    },
  };

  if (test) {
    payload.test = true;
  }

  return payload;
}

async function postContentWebhook(webhookUrl, payload, webhookSecret = '') {
  const rawBody = JSON.stringify(payload);
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Arivu-ContentPublishing/1.0',
  };
  const signature = signWebhookBody(rawBody, webhookSecret);
  if (signature) {
    headers['X-Arivu-Signature'] = signature;
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers,
    body: rawBody,
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Webhook returned HTTP ${response.status}`);
  }

  return response;
}

async function resolveAddonPublishing(organizationId, addonKey) {
  if (addonKey === 'blog') {
    const {
      getBlogPublishingSettings,
      resolvePublishWebhookSecret,
    } = require('./blogAddonSettingsService');
    const publishing = await getBlogPublishingSettings(organizationId);
    const webhookSecret = await resolvePublishWebhookSecret(organizationId);
    return { publishing, webhookSecret };
  }

  const {
    getArticlesPublishingSettings,
    resolvePublishWebhookSecret,
  } = require('./articlesAddonSettingsService');
  const publishing = await getArticlesPublishingSettings(organizationId);
  const webhookSecret = await resolvePublishWebhookSecret(organizationId);
  return { publishing, webhookSecret };
}

async function emitContentWebhook({
  organizationId,
  document,
  event,
}) {
  if (!organizationId || !document) return;
  const addonKey = resolveAddonKey(document);
  if (addonKey !== 'articles' && addonKey !== 'blog') return;

  let publishing;
  let webhookSecret;
  try {
    ({ publishing, webhookSecret } = await resolveAddonPublishing(organizationId, addonKey));
  } catch (error) {
    if (error?.code === 'WEBHOOK_SECRET_UNREADABLE') {
      console.error(
        `[contentPublishingWebhook] Skipping ${event}: stored webhook secret is unreadable for org ${organizationId}`,
      );
      return;
    }
    throw error;
  }

  const webhookUrl = String(publishing.publishWebhookUrl || '').trim();
  if (!webhookUrl) return;

  const organization = await Organization.findById(organizationId)
    .select('slug embed.articles.publicKey embed.blog.publicKey')
    .lean();
  if (!organization) return;

  const staticExport = await resolveWebhookStaticExportFields(organizationId, document, organization);
  const payload = buildWebhookPayload({
    event,
    organization,
    document,
    staticExport,
  });

  await postContentWebhook(webhookUrl, payload, webhookSecret);
}

async function emitContentPublishedWebhook({
  organizationId,
  document,
}) {
  return emitContentWebhook({
    organizationId,
    document,
    event: 'content.published',
  });
}

async function emitContentUnpublishedWebhook({
  organizationId,
  document,
}) {
  return emitContentWebhook({
    organizationId,
    document,
    event: 'content.unpublished',
  });
}

async function sendArticlesPublishWebhookTest(organizationId) {
  const {
    getArticlesPublishingSettings,
    resolvePublishWebhookSecret,
  } = require('./articlesAddonSettingsService');
  const publishing = await getArticlesPublishingSettings(organizationId);
  const webhookUrl = String(publishing.publishWebhookUrl || '').trim();
  if (!webhookUrl) {
    const error = new Error('Publish webhook URL is not configured');
    error.code = 'WEBHOOK_NOT_CONFIGURED';
    throw error;
  }

  const organization = await Organization.findById(organizationId)
    .select('slug embed.articles.publicKey')
    .lean();
  if (!organization) {
    const error = new Error('Organization not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  const collectionPath = ['getting-started'];
  const payload = buildWebhookPayload({
    event: 'content.published',
    organization,
    document: {
      _id: '000000000000000000000000',
      addonKey: 'articles',
      contentType: 'knowledge_article',
      slug: 'example-article',
      title: 'Example article (test webhook)',
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      seo: {},
    },
    staticExport: {
      updatedAt: new Date().toISOString(),
      exportUrl: buildArticleExportUrl(organization, 'example-article'),
      exportPath: buildArticleExportPath({
        slug: 'example-article',
        collectionPathSlugs: collectionPath,
      }),
      collectionPath,
      refreshPages: buildRefreshPages(collectionPath),
    },
    test: true,
  });
  const webhookSecret = await resolvePublishWebhookSecret(organizationId);

  await postContentWebhook(webhookUrl, payload, webhookSecret);
  return payload;
}

async function sendBlogPublishWebhookTest(organizationId) {
  const {
    getBlogPublishingSettings,
    resolvePublishWebhookSecret,
  } = require('./blogAddonSettingsService');
  const publishing = await getBlogPublishingSettings(organizationId);
  const webhookUrl = String(publishing.publishWebhookUrl || '').trim();
  if (!webhookUrl) {
    const error = new Error('Publish webhook URL is not configured');
    error.code = 'WEBHOOK_NOT_CONFIGURED';
    throw error;
  }

  const organization = await Organization.findById(organizationId)
    .select('slug embed.blog.publicKey')
    .lean();
  if (!organization) {
    const error = new Error('Organization not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  const payload = buildWebhookPayload({
    event: 'content.published',
    organization,
    document: {
      _id: '000000000000000000000000',
      addonKey: 'blog',
      contentType: 'blog_post',
      slug: 'example-post',
      title: 'Example post (test webhook)',
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      seo: {},
    },
    staticExport: {
      updatedAt: new Date().toISOString(),
      exportUrl: buildBlogPostExportUrl(organization, 'example-post'),
      exportPath: buildArticleExportPath({
        slug: 'example-post',
        collectionPathSlugs: [],
        pathPrefix: '/blog/',
      }),
      collectionPath: [],
      refreshPages: buildRefreshPages([], '/blog/'),
    },
    test: true,
  });
  const webhookSecret = await resolvePublishWebhookSecret(organizationId);

  await postContentWebhook(webhookUrl, payload, webhookSecret);
  return payload;
}

module.exports = {
  buildWebhookPayload,
  resolveWebhookStaticExportFields,
  signWebhookBody,
  verifyWebhookSignature,
  emitContentPublishedWebhook,
  emitContentUnpublishedWebhook,
  sendArticlesPublishWebhookTest,
  sendBlogPublishWebhookTest,
};
