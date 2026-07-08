'use strict';

const publicContentService = require('../services/contentStudio/publicContentService');
const headlessStaticExportService = require('../services/contentStudio/headlessStaticExportService');
const articleAnalyticsService = require('../services/contentStudio/articleAnalyticsService');
const fileStorage = require('../services/fileStorageService');
const { renderBlocksToHtml } = require('../services/contentStudio/contentStudioBlockRenderer');
const { assertValidBlockDocument } = require('../services/contentStudio/contentBlockValidationService');
const { absolutizePublicAssetUrlsInHtml } = require('../services/contentStudio/headlessContentShaper');
const { getPublicAppBaseUrl, resolveRequestOrigin } = require('../services/contentStudio/contentPublishingService');

const PUBLIC_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';
const PUBLIC_MANIFEST_CACHE_CONTROL = 'public, max-age=30, s-maxage=60, stale-while-revalidate=120';
const PUBLIC_ASSET_CACHE_CONTROL = 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800';

function applyPublicCacheHeaders(res) {
  res.set('Cache-Control', PUBLIC_CACHE_CONTROL);
}

async function listPublicHelpArticles(req, res) {
  try {
    const result = await publicContentService.listPublicHelpArticles({
      orgSlug: req.params.orgSlug,
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      collection: req.query.collection,
      deep: req.query.deep,
    });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    applyPublicCacheHeaders(res);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[publicContentController] listPublicHelpArticles', error);
    return res.status(500).json({ success: false, message: 'Failed to load help articles' });
  }
}

async function listPublicRecentHelpArticles(req, res) {
  try {
    const result = await publicContentService.listPublicRecentHelpArticles({
      orgSlug: req.params.orgSlug,
      limit: req.query.limit,
      collection: req.query.collection,
      deep: req.query.deep,
    });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    applyPublicCacheHeaders(res);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[publicContentController] listPublicRecentHelpArticles', error);
    return res.status(500).json({ success: false, message: 'Failed to load recent help articles' });
  }
}

async function listPublicPopularHelpArticles(req, res) {
  try {
    const result = await publicContentService.listPublicPopularHelpArticles({
      orgSlug: req.params.orgSlug,
      limit: req.query.limit,
      collection: req.query.collection,
      deep: req.query.deep,
    });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    applyPublicCacheHeaders(res);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[publicContentController] listPublicPopularHelpArticles', error);
    return res.status(500).json({ success: false, message: 'Failed to load popular help articles' });
  }
}

async function listPublicHelpCollections(req, res) {
  try {
    const result = await publicContentService.listPublicHelpCollections({
      orgSlug: req.params.orgSlug,
    });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    applyPublicCacheHeaders(res);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[publicContentController] listPublicHelpCollections', error);
    return res.status(500).json({ success: false, message: 'Failed to load help collections' });
  }
}

async function getPublicHelpArticle(req, res) {
  try {
    const result = await publicContentService.getPublicHelpArticle({
      orgSlug: req.params.orgSlug,
      articleSlug: req.params.slug,
      requestOrigin: resolveRequestOrigin(req),
    });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    applyPublicCacheHeaders(res);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[publicContentController] getPublicHelpArticle', error);
    return res.status(500).json({ success: false, message: 'Failed to load help article' });
  }
}

async function getPublicHelpSitemap(req, res) {
  try {
    const result = await publicContentService.getPublicHelpSitemap({
      orgSlug: req.params.orgSlug,
    });

    if (!result) {
      return res.status(404).type('text/plain').send('Not found');
    }

    applyPublicCacheHeaders(res);
    res.type('application/xml');
    return res.send(result.xml);
  } catch (error) {
    console.error('[publicContentController] getPublicHelpSitemap', error);
    return res.status(500).type('text/plain').send('Failed to generate sitemap');
  }
}

function parseBooleanQuery(value) {
  const raw = String(value || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

async function getPublicHelpManifest(req, res) {
  try {
    const result = await headlessStaticExportService.getPublicHelpManifest({
      orgSlug: req.params.orgSlug,
      pathPrefix: req.query.pathPrefix,
      requestOrigin: resolveRequestOrigin(req),
    });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    res.set('Cache-Control', PUBLIC_MANIFEST_CACHE_CONTROL);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[publicContentController] getPublicHelpManifest', error);
    return res.status(500).json({ success: false, message: 'Failed to load help manifest' });
  }
}

async function getPublicHelpArticleExport(req, res) {
  try {
    const result = await headlessStaticExportService.getPublicHelpArticleExport({
      orgSlug: req.params.orgSlug,
      articleSlug: req.params.slug,
      pathPrefix: req.query.pathPrefix,
      fragment: parseBooleanQuery(req.query.fragment),
      chrome: parseBooleanQuery(req.query.chrome),
      articleLinkPrefix: req.query.articleLinkPrefix,
      requestOrigin: resolveRequestOrigin(req),
    });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    applyPublicCacheHeaders(res);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[publicContentController] getPublicHelpArticleExport', error);
    return res.status(500).json({ success: false, message: 'Failed to export help article' });
  }
}

async function getPublicHelpHomeExport(req, res) {
  try {
    const result = await headlessStaticExportService.getPublicHelpHomeExport({
      orgSlug: req.params.orgSlug,
      pathPrefix: req.query.pathPrefix,
      fragment: parseBooleanQuery(req.query.fragment),
      chrome: parseBooleanQuery(req.query.chrome),
      requestOrigin: resolveRequestOrigin(req),
    });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    applyPublicCacheHeaders(res);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[publicContentController] getPublicHelpHomeExport', error);
    return res.status(500).json({ success: false, message: 'Failed to export help home page' });
  }
}

async function getPublicHelpCollectionExport(req, res) {
  try {
    const result = await headlessStaticExportService.getPublicHelpCollectionExport({
      orgSlug: req.params.orgSlug,
      collectionSlug: req.params.slug,
      parentSlug: req.query.parent,
      pathPrefix: req.query.pathPrefix,
      fragment: parseBooleanQuery(req.query.fragment),
      chrome: parseBooleanQuery(req.query.chrome),
      requestOrigin: resolveRequestOrigin(req),
    });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    applyPublicCacheHeaders(res);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[publicContentController] getPublicHelpCollectionExport', error);
    return res.status(500).json({ success: false, message: 'Failed to export help collection page' });
  }
}

async function getPublicHelpStaticSitemapExport(req, res) {
  try {
    const result = await headlessStaticExportService.getPublicHelpStaticSitemap({
      orgSlug: req.params.orgSlug,
      pathPrefix: req.query.pathPrefix,
      siteOrigin: req.query.siteOrigin,
      requestOrigin: resolveRequestOrigin(req),
    });

    if (!result) {
      return res.status(404).type('text/plain').send('Not found');
    }

    applyPublicCacheHeaders(res);
    res.type('application/xml');
    return res.send(result.xml);
  } catch (error) {
    console.error('[publicContentController] getPublicHelpStaticSitemapExport', error);
    return res.status(500).type('text/plain').send('Failed to generate sitemap');
  }
}

async function downloadPublicHelpAsset(req, res) {
  try {
    const result = await headlessStaticExportService.getPublicHelpAssetForDownload({
      orgSlug: req.params.orgSlug,
      assetId: req.params.assetId,
    });

    if (!result?.asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    const buffer = await fileStorage.getObjectBuffer(result.asset.storageKey);
    if (!buffer) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    const safeName = String(result.asset.filename || 'asset').replace(/[\r\n"]/g, '_');
    res.set('Content-Type', result.asset.mimeType || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${safeName}"`);
    res.set('Cache-Control', PUBLIC_ASSET_CACHE_CONTROL);
    return res.send(buffer);
  } catch (error) {
    console.error('[publicContentController] downloadPublicHelpAsset', error);
    return res.status(500).json({ success: false, message: 'Failed to download asset' });
  }
}

async function submitPublicArticleFeedback(req, res) {
  try {
    const result = await articleAnalyticsService.submitPublicArticleFeedback({
      orgSlug: req.params.orgSlug,
      articleSlug: req.params.slug,
      helpful: req.body?.helpful,
      action: req.body?.action,
      platform: req.body?.platform,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || '',
    });

    res.set('Cache-Control', 'no-store');
    return res.json({
      success: true,
      data: result,
      message: result.duplicate ? 'Feedback already recorded' : 'Feedback recorded',
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) {
      console.error('[publicContentController] submitPublicArticleFeedback', error);
    }
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to record article feedback',
    });
  }
}

async function renderPublicBlocks(req, res) {
  try {
    const blocks = req.body?.blocks;
    if (!blocks) {
      return res.status(400).json({ success: false, message: 'blocks are required' });
    }
    assertValidBlockDocument(blocks);
    const publicAppBaseUrl = getPublicAppBaseUrl({ requestOrigin: resolveRequestOrigin(req) });
    const html = absolutizePublicAssetUrlsInHtml(
      renderBlocksToHtml(blocks, {
        title: req.body?.title || '',
        subtitle: req.body?.subtitle || '',
        bodyOnly: Boolean(req.body?.bodyOnly),
        articleLinkPrefix: req.body?.articleLinkPrefix || '/help/',
      }),
      publicAppBaseUrl,
    );
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, html });
  } catch (error) {
    console.error('[publicContentController] renderPublicBlocks', error);
    const statusCode = error?.statusCode === 400 || error?.code === 'INVALID_BLOCKS' ? 400 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'Failed to render blocks',
    });
  }
}

module.exports = {
  listPublicHelpArticles,
  listPublicRecentHelpArticles,
  listPublicPopularHelpArticles,
  listPublicHelpCollections,
  getPublicHelpArticle,
  getPublicHelpSitemap,
  getPublicHelpManifest,
  getPublicHelpHomeExport,
  getPublicHelpCollectionExport,
  getPublicHelpStaticSitemapExport,
  getPublicHelpArticleExport,
  downloadPublicHelpAsset,
  submitPublicArticleFeedback,
  renderPublicBlocks,
};
