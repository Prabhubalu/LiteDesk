'use strict';

const publicContentService = require('../services/contentStudio/publicContentService');
const articleAnalyticsService = require('../services/contentStudio/articleAnalyticsService');
const { renderBlocksToHtml } = require('../services/contentStudio/contentStudioBlockRenderer');
const { assertValidBlockDocument } = require('../services/contentStudio/contentBlockValidationService');

const PUBLIC_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

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
    const html = renderBlocksToHtml(blocks, {
      title: req.body?.title || '',
      subtitle: req.body?.subtitle || '',
      bodyOnly: Boolean(req.body?.bodyOnly),
      articleLinkPrefix: req.body?.articleLinkPrefix || '/help/',
    });
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
  submitPublicArticleFeedback,
  renderPublicBlocks,
};
