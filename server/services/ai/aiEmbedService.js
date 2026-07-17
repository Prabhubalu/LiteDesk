const crypto = require('crypto');
const Document = require('../../models/Document');
const ContentDocument = require('../../models/ContentDocument');
const ContentDocumentVersion = require('../../models/ContentDocumentVersion');
const AiVectorChunk = require('../../models/AiVectorChunk');
const { resolveEmbeddingModel } = require('../../constants/aiProviders');
const { resolveAiRequestConfig } = require('./aiSettingsResolver');
const { getEmbeddingAdapter } = require('./providerRegistry');
const { getVectorStore } = require('./vector/vectorStoreRegistry');
const { assertCreditsAvailable, debitCredits } = require('./aiCreditService');
const { writeAiAuditLog } = require('./aiAuditLogService');
const { redactText } = require('./piiRedaction');
const { AiConfigurationError } = require('./errors');

const MAX_CHUNK_CHARS = 1200;
const CHUNK_OVERLAP = 150;
const EMBEDDING_VERSION = 1;

function hashChunks(chunks, embeddingModel) {
  return crypto
    .createHash('sha256')
    .update(`${embeddingModel}:${EMBEDDING_VERSION}:${(chunks || []).join('\u0000')}`)
    .digest('hex');
}

function chunkText(text) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  if (cleaned.length <= MAX_CHUNK_CHARS) return [cleaned];

  const chunks = [];
  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(cleaned.length, start + MAX_CHUNK_CHARS);
    chunks.push(cleaned.slice(start, end));
    if (end >= cleaned.length) break;
    start = Math.max(0, end - CHUNK_OVERLAP);
  }
  return chunks;
}

function extractRichContentSearchText(richContent) {
  const html = typeof richContent === 'string'
    ? richContent
    : richContent?.html || '';
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveDocumentCorpusMeta(doc) {
  const documentType = String(doc?.documentType || '').trim().toLowerCase();
  if (documentType === 'knowledge_article') {
    return {
      sourceType: 'article',
      appKey: 'HELPDESK',
      moduleKey: 'articles',
    };
  }
  if (documentType === 'playbook' || documentType === 'sop') {
    return {
      sourceType: 'document',
      appKey: 'HELPDESK',
      moduleKey: 'documents',
    };
  }
  return {
    sourceType: 'document',
    appKey: 'SALES',
    moduleKey: 'documents',
  };
}

function resolveContentDocumentCorpusMeta(doc) {
  const addonKey = String(doc?.addonKey || '').trim().toLowerCase();
  const contentType = String(doc?.contentType || '').trim().toLowerCase();
  if (addonKey === 'blog' || contentType === 'blog_post') {
    return {
      sourceType: 'article',
      appKey: String(doc?.appKey || 'SALES').toUpperCase(),
      moduleKey: 'blog',
    };
  }
  return {
    sourceType: 'article',
    appKey: String(doc?.appKey || 'HELPDESK').toUpperCase(),
    moduleKey: 'articles',
  };
}

function buildDocumentSourceText(doc) {
  const parts = [
    doc.title,
    doc.description,
    doc.richContentText,
    extractRichContentSearchText(doc.richContent),
    doc.body?.content,
    doc.ocrText,
  ].filter(Boolean);
  return redactText(parts.join('\n\n'));
}

function buildContentDocumentSourceText(doc) {
  const parts = [
    doc.title,
    doc.subtitle,
    doc.summary,
    doc.searchText,
  ].filter(Boolean);
  return redactText(parts.join('\n\n'));
}

async function upsertEmbeddedChunks({
  organizationId,
  userId,
  abilityKey,
  sourceType,
  sourceId,
  appKey,
  moduleKey,
  chunks,
  config,
  startedAt,
}) {
  const store = getVectorStore();
  const embeddingModel = resolveEmbeddingModel(config.embeddingProvider);

  if (!chunks.length) {
    await store.deleteBySource(organizationId, sourceType, String(sourceId));
    return { chunkCount: 0, creditsDebited: 0 };
  }

  const contentHash = hashChunks(chunks, embeddingModel);

  // Skip re-embedding when the source content + model are unchanged.
  const existing = await AiVectorChunk.findOne({
    organizationId,
    sourceType,
    sourceId: String(sourceId),
  }).select('contentHash embeddingModel embeddingVersion').lean();
  if (
    existing
    && existing.contentHash === contentHash
    && existing.embeddingModel === embeddingModel
    && Number(existing.embeddingVersion) === EMBEDDING_VERSION
  ) {
    return {
      chunkCount: 0,
      creditsDebited: 0,
      embeddingModel,
      sourceType,
      skipped: 'unchanged',
    };
  }

  await store.deleteBySource(organizationId, sourceType, String(sourceId));

  assertCreditsAvailable({
    keyMode: config.keyMode,
    creditsBalance: config.creditsBalance,
  });

  const embeddingAdapter = getEmbeddingAdapter(config.embeddingProvider);
  const embedded = await embeddingAdapter.embed({
    apiKey: config.embeddingApiKey || config.apiKey,
    model: embeddingModel,
    texts: chunks,
  });

  const vectors = embedded.vectors || [];
  const rows = chunks.map((text, index) => ({
    organizationId,
    sourceType,
    sourceId: String(sourceId),
    chunkId: `${organizationId}:${sourceType}:${sourceId}:${index}`,
    chunkIndex: index,
    text,
    embedding: vectors[index] || [],
    embeddingModel,
    embeddingVersion: EMBEDDING_VERSION,
    contentHash,
    appKey,
    moduleKey,
  }));

  await store.upsert(rows);

  const creditsDebited = await debitCredits({
    organizationId,
    keyMode: config.keyMode,
    usage: embedded.usage,
  });

  await writeAiAuditLog({
    organizationId,
    userId: userId || null,
    abilityKey,
    provider: config.embeddingProvider,
    model: embeddingModel,
    keyMode: config.keyMode,
    status: 'success',
    contextRefs: [{ sourceType, sourceId: String(sourceId), appKey, moduleKey }],
    usage: embedded.usage,
    creditsDebited,
    latencyMs: Date.now() - startedAt,
  });

  return {
    chunkCount: rows.length,
    creditsDebited,
    embeddingModel,
    sourceType,
  };
}

async function embedDocumentSource({ organizationId, documentId, userId = null }) {
  const startedAt = Date.now();
  const doc = await Document.findOne({
    _id: documentId,
    organizationId,
    deletedAt: null,
  }).lean();

  if (!doc) {
    throw new AiConfigurationError('Document not found', 'AI_DOCUMENT_NOT_FOUND');
  }

  const meta = resolveDocumentCorpusMeta(doc);
  const sourceText = buildDocumentSourceText(doc);
  const chunks = chunkText(sourceText);
  const config = await resolveAiRequestConfig({
    organizationId,
    abilityKey: 'embed',
  });

  // Clear legacy rows that may have used sourceType=document for articles.
  if (meta.sourceType === 'article') {
    const store = getVectorStore();
    await store.deleteBySource(organizationId, 'document', String(documentId));
  }

  return upsertEmbeddedChunks({
    organizationId,
    userId,
    abilityKey: 'embed',
    sourceType: meta.sourceType,
    sourceId: documentId,
    appKey: meta.appKey,
    moduleKey: meta.moduleKey,
    chunks,
    config,
    startedAt,
  });
}

async function embedContentDocumentSource({ organizationId, contentDocumentId, userId = null }) {
  const startedAt = Date.now();
  const doc = await ContentDocument.findOne({
    organizationId,
    _id: contentDocumentId,
    deletedAt: null,
  }).lean();

  if (!doc) {
    throw new AiConfigurationError('Content document not found', 'AI_CONTENT_DOCUMENT_NOT_FOUND');
  }

  if (String(doc.status || '').toLowerCase() !== 'published') {
    const store = getVectorStore();
    const meta = resolveContentDocumentCorpusMeta(doc);
    await store.deleteBySource(organizationId, meta.sourceType, String(contentDocumentId));
    return { chunkCount: 0, creditsDebited: 0, skipped: 'not_published' };
  }

  let sourceText = buildContentDocumentSourceText(doc);
  if (!sourceText && doc.publishedVersionId) {
    const version = await ContentDocumentVersion.findOne({
      _id: doc.publishedVersionId,
      organizationId,
      contentDocumentId: doc._id,
    }).lean();
    if (version) {
      try {
        const { blocksToPlainText } = require('../contentStudio/contentStudioBlockRenderer');
        const blockText = blocksToPlainText(version.blocks || version.document?.blocks || {});
        sourceText = buildContentDocumentSourceText({
          ...doc,
          searchText: blockText,
        });
      } catch {
        /* keep empty */
      }
    }
  }

  const meta = resolveContentDocumentCorpusMeta(doc);
  const chunks = chunkText(sourceText);
  const config = await resolveAiRequestConfig({
    organizationId,
    abilityKey: 'embed',
  });

  return upsertEmbeddedChunks({
    organizationId,
    userId,
    abilityKey: 'embed',
    sourceType: meta.sourceType,
    sourceId: contentDocumentId,
    appKey: meta.appKey,
    moduleKey: meta.moduleKey,
    chunks,
    config,
    startedAt,
  });
}

async function removeContentDocumentEmbeddings({ organizationId, contentDocumentId, addonKey = null, appKey = null }) {
  const store = getVectorStore();
  const meta = resolveContentDocumentCorpusMeta({ addonKey, appKey });
  await store.deleteBySource(organizationId, meta.sourceType, String(contentDocumentId));
  return { deleted: true, sourceType: meta.sourceType };
}

module.exports = {
  embedDocumentSource,
  embedContentDocumentSource,
  removeContentDocumentEmbeddings,
  chunkText,
  buildDocumentSourceText,
  buildContentDocumentSourceText,
  resolveDocumentCorpusMeta,
  resolveContentDocumentCorpusMeta,
  EMBEDDING_VERSION,
};
