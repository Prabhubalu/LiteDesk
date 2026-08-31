'use strict';

/**
 * Tenant Knowledge Sources admin — toggles + curated website pages.
 */

const crypto = require('crypto');
const AstraKnowledgeSources = require('../../../models/AstraKnowledgeSources');
const LiveChatWebsiteContentPage = require('../../../models/LiveChatWebsiteContentPage');
const { getVectorStore } = require('../../ai/vector/vectorStoreRegistry');
const { resolveAiRequestConfig } = require('../../ai/aiSettingsResolver');
const { getEmbeddingAdapter } = require('../../ai/providerRegistry');
const { resolveEmbeddingModel } = require('../../../constants/aiProviders');

function pageKeyFromUrl(url, title) {
  const base = String(url || title || 'page')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || `page-${crypto.randomBytes(3).toString('hex')}`;
}

async function getKnowledgeSources(organizationId) {
  let sources = {
    articlesEnabled: true,
    documentsEnabled: true,
    websiteEnabled: true,
  };
  if (organizationId) {
    const doc = await AstraKnowledgeSources.findOne({ organizationId }).lean();
    if (doc) {
      sources = {
        articlesEnabled: doc.articlesEnabled !== false,
        documentsEnabled: doc.documentsEnabled !== false,
        websiteEnabled: doc.websiteEnabled !== false,
      };
    }
  }
  const pages = organizationId
    ? await LiveChatWebsiteContentPage.find({ organizationId }).sort({ order: 1, title: 1 }).lean()
    : [];
  return {
    sources,
    websitePages: pages.map((p) => ({
      id: String(p._id),
      pageKey: p.pageKey,
      title: p.title,
      body: p.body,
      matchPath: p.matchPath || '',
      sourceUrl: p.sourceUrl || '',
      audience: p.audience || 'public',
      enabled: p.enabled !== false,
      order: p.order || 0,
    })),
  };
}

async function updateKnowledgeSources(organizationId, patch = {}, userId = null) {
  if (!organizationId) {
    const err = new Error('organizationId required');
    err.statusCode = 400;
    throw err;
  }
  const update = { updatedBy: userId || null };
  if (patch.articlesEnabled !== undefined) update.articlesEnabled = Boolean(patch.articlesEnabled);
  if (patch.documentsEnabled !== undefined) update.documentsEnabled = Boolean(patch.documentsEnabled);
  if (patch.websiteEnabled !== undefined) update.websiteEnabled = Boolean(patch.websiteEnabled);

  const doc = await AstraKnowledgeSources.findOneAndUpdate(
    { organizationId },
    { $set: update, $setOnInsert: { organizationId } },
    { upsert: true, new: true },
  ).lean();

  return getKnowledgeSources(organizationId).then((data) => ({
    ...data,
    sources: {
      articlesEnabled: doc.articlesEnabled !== false,
      documentsEnabled: doc.documentsEnabled !== false,
      websiteEnabled: doc.websiteEnabled !== false,
    },
  }));
}

async function fetchUrlText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Arivu-AstraKnowledge/1.0' },
      redirect: 'follow',
    });
    if (!res.ok) {
      throw new Error(`Fetch failed (${res.status})`);
    }
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 20000);
    return { title, body: text };
  } finally {
    clearTimeout(timer);
  }
}

async function embedWebsitePage(organizationId, page) {
  const text = `${page.title || ''}\n${page.body || ''}`.trim();
  if (!text || !organizationId) return;
  try {
    const cfg = await resolveAiRequestConfig({ organizationId, purpose: 'embedding' });
    const embeddingModel = resolveEmbeddingModel(cfg);
    const adapter = getEmbeddingAdapter(cfg);
    if (!adapter?.embed) return;
    const chunks = [];
    const size = 1200;
    for (let i = 0; i < text.length; i += size - 150) {
      chunks.push(text.slice(i, i + size));
      if (chunks.length >= 8) break;
    }
    const vectors = await adapter.embed({ texts: chunks, model: embeddingModel, organizationId });
    const store = getVectorStore();
    const sourceId = String(page._id || page.id);
    await store.deleteBySource?.(organizationId, 'website', sourceId);
    const rows = chunks.map((chunkText, idx) => ({
      organizationId,
      sourceType: 'website',
      sourceId,
      chunkId: `${sourceId}:${idx}`,
      chunkIndex: idx,
      text: chunkText,
      embedding: vectors[idx],
      embeddingModel,
      embeddingVersion: 1,
      contentHash: crypto.createHash('sha256').update(chunkText).digest('hex'),
      appKey: 'HELPDESK',
      moduleKey: 'website',
    }));
    await store.upsert(rows);
  } catch (err) {
    console.warn('[knowledgeSources] embed website page failed:', err?.message || err);
  }
}

async function addWebsitePage(organizationId, body = {}, userId = null) {
  if (!organizationId) {
    const err = new Error('organizationId required');
    err.statusCode = 400;
    throw err;
  }
  let title = String(body.title || '').trim();
  let pageBody = String(body.body || '').trim();
  const sourceUrl = String(body.url || body.sourceUrl || '').trim();
  const audience = body.audience === 'internal' ? 'internal' : 'public';

  if (sourceUrl && !pageBody) {
    const fetched = await fetchUrlText(sourceUrl);
    if (!title) title = fetched.title || sourceUrl;
    pageBody = fetched.body;
  }
  if (!title) title = sourceUrl || 'Website page';
  if (!pageBody) {
    const err = new Error('Provide page body or a fetchable URL');
    err.statusCode = 400;
    err.code = 'KNOWLEDGE_PAGE_EMPTY';
    throw err;
  }

  const pageKey = String(body.pageKey || pageKeyFromUrl(sourceUrl, title)).slice(0, 80);
  const doc = await LiveChatWebsiteContentPage.findOneAndUpdate(
    { organizationId, pageKey },
    {
      $set: {
        title,
        body: pageBody,
        matchPath: body.matchPath || (sourceUrl ? (() => {
          try { return new URL(sourceUrl).pathname; } catch { return ''; }
        })() : ''),
        sourceUrl,
        audience,
        enabled: body.enabled !== false,
        order: Number(body.order) || 0,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        organizationId,
        pageKey,
        createdAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );

  await embedWebsitePage(organizationId, doc);

  return {
    id: String(doc._id),
    pageKey: doc.pageKey,
    title: doc.title,
    body: doc.body,
    sourceUrl: doc.sourceUrl || sourceUrl,
    audience: doc.audience || audience,
    enabled: doc.enabled !== false,
  };
}

async function deleteWebsitePage(organizationId, pageId) {
  const page = await LiveChatWebsiteContentPage.findOneAndDelete({
    organizationId,
    _id: pageId,
  });
  if (page) {
    try {
      const store = getVectorStore();
      await store.deleteBySource?.(organizationId, 'website', String(page._id));
    } catch {
      /* soft */
    }
  }
  return { deleted: Boolean(page) };
}

module.exports = {
  getKnowledgeSources,
  updateKnowledgeSources,
  addWebsitePage,
  deleteWebsitePage,
  embedWebsitePage,
  fetchUrlText,
};
