'use strict';

const Organization = require('../../models/Organization');
const { buildArticleApiUrl } = require('./contentPublishingService');
const { getArticlesPublishingSettings } = require('./articlesAddonSettingsService');

function buildWebhookPayload({
  event,
  organization,
  document,
  test = false,
}) {
  const apiUrl = buildArticleApiUrl(organization, document.slug);
  const publicUrl = String(document?.seo?.canonicalUrl || document?.publicUrl || '').trim();

  const payload = {
    event,
    occurredAt: new Date().toISOString(),
    organization: { slug: organization.slug },
    content: {
      id: String(document._id || document.id || ''),
      addonKey: document.addonKey || 'articles',
      contentType: document.contentType || 'knowledge_article',
      slug: document.slug,
      title: document.title,
      publishedAt: document.publishedAt || null,
      apiUrl,
      publicUrl,
    },
  };

  if (test) {
    payload.test = true;
  }

  return payload;
}

async function postArticlesWebhook(webhookUrl, payload) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Arivu-ContentPublishing/1.0',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Webhook returned HTTP ${response.status}`);
  }

  return response;
}

async function emitArticlesContentWebhook({
  organizationId,
  document,
  event,
}) {
  if (!organizationId || !document) return;
  if (document.addonKey !== 'articles') return;

  const publishing = await getArticlesPublishingSettings(organizationId);
  const webhookUrl = String(publishing.publishWebhookUrl || '').trim();
  if (!webhookUrl) return;

  const organization = await Organization.findById(organizationId)
    .select('slug')
    .lean();
  if (!organization) return;

  const payload = buildWebhookPayload({
    event,
    organization,
    document,
  });

  await postArticlesWebhook(webhookUrl, payload);
}

async function emitContentPublishedWebhook({
  organizationId,
  document,
}) {
  return emitArticlesContentWebhook({
    organizationId,
    document,
    event: 'content.published',
  });
}

async function emitContentUnpublishedWebhook({
  organizationId,
  document,
}) {
  return emitArticlesContentWebhook({
    organizationId,
    document,
    event: 'content.unpublished',
  });
}

async function sendArticlesPublishWebhookTest(organizationId) {
  const publishing = await getArticlesPublishingSettings(organizationId);
  const webhookUrl = String(publishing.publishWebhookUrl || '').trim();
  if (!webhookUrl) {
    const error = new Error('Publish webhook URL is not configured');
    error.code = 'WEBHOOK_NOT_CONFIGURED';
    throw error;
  }

  const organization = await Organization.findById(organizationId)
    .select('slug')
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
      addonKey: 'articles',
      contentType: 'knowledge_article',
      slug: 'example-article',
      title: 'Example article (test webhook)',
      publishedAt: new Date().toISOString(),
      seo: {},
    },
    test: true,
  });

  await postArticlesWebhook(webhookUrl, payload);
  return payload;
}

module.exports = {
  buildWebhookPayload,
  emitContentPublishedWebhook,
  emitContentUnpublishedWebhook,
  sendArticlesPublishWebhookTest,
};
