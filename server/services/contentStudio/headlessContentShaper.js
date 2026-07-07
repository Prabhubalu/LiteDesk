'use strict';

const { blocksToPlainText } = require('./contentStudioBlockRenderer');
const { getAssetById } = require('../contentPlatform/contentAssetService');

const CONTENT_STUDIO_SUBTITLE_SIZES = new Set(['sm', 'md', 'lg', 'xl']);

function absolutizePublicAssetUrl(url, publicAppBaseUrl) {
  const raw = String(url || '').trim();
  if (!raw || !publicAppBaseUrl) return raw;
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) {
    return raw;
  }
  if (raw.startsWith('/')) {
    return `${String(publicAppBaseUrl).replace(/\/$/, '')}${raw}`;
  }
  return raw;
}

function absolutizePublicAssetUrlsInHtml(html, publicAppBaseUrl) {
  if (!html || !publicAppBaseUrl) return html;
  const base = String(publicAppBaseUrl).replace(/\/$/, '');
  return String(html).replace(
    /(\s(?:src|href)=["'])(\/api\/(?:files\/download|uploads)[^"']*)(["'])/gi,
    (_match, prefix, path, suffix) => `${prefix}${base}${path}${suffix}`,
  );
}

function normalizeHeadlessPresentation(presentation) {
  const defaults = {
    coverPosition: 'below-title',
    titleOverlapCover: false,
    subtitleSize: 'md',
    headingColor: '',
    subheadingColor: '',
  };
  if (!presentation || typeof presentation !== 'object') {
    return defaults;
  }
  const coverPosition = presentation.coverPosition === 'above-title' ? 'above-title' : 'below-title';
  const subtitleSize = CONTENT_STUDIO_SUBTITLE_SIZES.has(presentation.subtitleSize)
    ? presentation.subtitleSize
    : 'md';
  return {
    coverPosition,
    titleOverlapCover: coverPosition === 'above-title' && Boolean(presentation.titleOverlapCover),
    subtitleSize,
    headingColor: String(presentation.headingColor || '').trim(),
    subheadingColor: String(presentation.subheadingColor || '').trim(),
  };
}

function shapeHeadlessArticleSummary(doc, collectionMeta = null) {
  const collectionId = doc.collectionId ? String(doc.collectionId) : null;
  const meta = collectionMeta || null;
  return {
    id: String(doc._id),
    title: doc.title,
    slug: doc.slug,
    summary: doc.summary || doc.subtitle || '',
    updatedAt: doc.updatedAt,
    publishedAt: doc.publishedAt,
    collectionId,
    collectionSlug: meta?.slug || null,
    collectionName: meta?.name || null,
  };
}

async function resolveCoverImage(doc, publicAppBaseUrl = '') {
  if (!doc?.coverAssetId) return null;
  try {
    const asset = await getAssetById({
      organizationId: doc.organizationId,
      assetId: doc.coverAssetId,
    });
    if (!asset.downloadUrl) return null;
    return {
      url: absolutizePublicAssetUrl(asset.downloadUrl, publicAppBaseUrl),
      alt: String(asset.accessibilityAltText || '').trim(),
      width: asset.width || null,
      height: asset.height || null,
    };
  } catch {
    return null;
  }
}

async function shapeHeadlessSeo(seo, organizationId, publicAppBaseUrl = '') {
  const source = seo && typeof seo === 'object' ? seo : {};
  const shaped = {
    metaTitle: String(source.metaTitle || '').trim(),
    metaDescription: String(source.metaDescription || '').trim(),
    canonicalUrl: String(source.canonicalUrl || '').trim(),
    robots: String(source.robots || '').trim(),
    ogImageUrl: '',
  };

  if (source.ogImageAssetId && organizationId) {
    try {
      const asset = await getAssetById({
        organizationId,
        assetId: source.ogImageAssetId,
      });
      shaped.ogImageUrl = absolutizePublicAssetUrl(asset.downloadUrl || '', publicAppBaseUrl);
    } catch {
      shaped.ogImageUrl = '';
    }
  }

  return shaped;
}

async function resolveAssetUrlsInBlocks(blocks, organizationId, publicAppBaseUrl = '') {
  if (!blocks || typeof blocks !== 'object') return null;

  async function walk(node) {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) {
      return Promise.all(node.map((entry) => walk(entry)));
    }

    const result = { ...node };
    if (result.attrs && typeof result.attrs === 'object') {
      const attrs = { ...result.attrs };
      const assetId = attrs.assetId || attrs.contentAssetId;
      if (assetId && organizationId) {
        try {
          const asset = await getAssetById({ organizationId, assetId });
          if (asset.downloadUrl && !attrs.src) {
            attrs.src = asset.downloadUrl;
          }
          if (asset.accessibilityAltText && !attrs.alt) {
            attrs.alt = asset.accessibilityAltText;
          }
        } catch {
          // Keep existing attrs when asset lookup fails.
        }
      }
      if (attrs.src) {
        attrs.src = absolutizePublicAssetUrl(attrs.src, publicAppBaseUrl);
      }
      if (attrs.imageUrl) {
        attrs.imageUrl = absolutizePublicAssetUrl(attrs.imageUrl, publicAppBaseUrl);
      }
      delete attrs.assetId;
      delete attrs.contentAssetId;
      result.attrs = attrs;
    }

    if (Array.isArray(result.content)) {
      result.content = await Promise.all(result.content.map((entry) => walk(entry)));
    }

    return result;
  }

  return walk(blocks);
}

function estimateReadMinutes(text) {
  const words = String(text || '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

async function shapeHeadlessArticleDetail(doc, {
  blocks,
  authorName = '',
  collectionName = '',
  collectionMeta = null,
  publicAppBaseUrl = '',
}) {
  const resolvedBlocks = blocks
    ? await resolveAssetUrlsInBlocks(blocks, doc.organizationId, publicAppBaseUrl)
    : null;
  const plainText = resolvedBlocks
    ? blocksToPlainText(resolvedBlocks)
    : String(doc.searchText || doc.summary || '');
  const readSource = [doc.title, doc.subtitle, plainText].filter(Boolean).join(' ');
  const meta = collectionMeta || null;

  return {
    ...shapeHeadlessArticleSummary(doc, meta),
    subtitle: doc.subtitle || '',
    seo: await shapeHeadlessSeo(doc.seo, doc.organizationId, publicAppBaseUrl),
    coverImage: await resolveCoverImage(doc, publicAppBaseUrl),
    authorName,
    collectionName: collectionName || meta?.name || '',
    readMinutes: estimateReadMinutes(readSource),
    plainText,
    presentation: normalizeHeadlessPresentation(doc.presentation),
    blocks: resolvedBlocks,
  };
}

module.exports = {
  absolutizePublicAssetUrl,
  absolutizePublicAssetUrlsInHtml,
  shapeHeadlessArticleSummary,
  shapeHeadlessArticleDetail,
  shapeHeadlessSeo,
  resolveAssetUrlsInBlocks,
  resolveCoverImage,
};
