'use strict';

const contentDocumentService = require('../services/contentStudio/contentDocumentService');
const contentCollectionService = require('../services/contentStudio/contentCollectionService');
const { renderBlocksToHtml } = require('../services/contentStudio/contentStudioBlockRenderer');
const { assertValidBlockDocument } = require('../services/contentStudio/contentBlockValidationService');
const { ADDON_KEYS } = require('../constants/addonKeys');

function sendContentStudioError(res, error) {
  const statusCode = error?.statusCode || 500;
  if (statusCode >= 500) {
    console.error('[contentStudioController]', error);
  }
  return res.status(statusCode).json({
    success: false,
    message: error?.message || 'Content Studio request failed',
    code: error?.code || 'CONTENT_STUDIO_ERROR',
  });
}

exports.getBlockRegistry = async (req, res) => {
  try {
    const blocks = await contentDocumentService.getBlockRegistry();
    return res.json({ success: true, blocks });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.renderPreview = async (req, res) => {
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
    });
    return res.json({ success: true, html });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.listArticles = async (req, res) => {
  try {
    const result = await contentDocumentService.listContentDocuments({
      organizationId: req.user.organizationId,
      addonKey: ADDON_KEYS.ARTICLES,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      collectionId: req.query.collectionId,
      visibility: req.query.visibility,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.createArticle = async (req, res) => {
  try {
    const data = await contentDocumentService.createContentDocument({
      organizationId: req.user.organizationId,
      addonKey: ADDON_KEYS.ARTICLES,
      title: req.body?.title,
      slug: req.body?.slug,
      summary: req.body?.summary,
      visibility: req.body?.visibility,
      featured: req.body?.featured,
      blocks: req.body?.blocks,
      collectionId: req.body?.collectionId,
      coverAssetId: req.body?.coverAssetId,
      presentation: req.body?.presentation,
      authorId: req.body?.authorId,
      authorName: req.body?.authorName,
      userId: req.user._id,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.getArticleAnalytics = async (req, res) => {
  try {
    const articleAnalyticsService = require('../services/contentStudio/articleAnalyticsService');
    const doc = await contentDocumentService.getContentDocumentById({
      organizationId: req.user.organizationId,
      id: req.params.id,
    });
    const analytics = await articleAnalyticsService.getArticleAnalytics({
      organizationId: req.user.organizationId,
      contentDocumentId: doc._id,
    });
    return res.json({ success: true, data: analytics });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.getArticle = async (req, res) => {
  try {
    const data = await contentDocumentService.getContentDocumentById({
      organizationId: req.user.organizationId,
      id: req.params.id,
    });
    const { getArticlesAddonSettings, evaluateStaleContent } = require('../services/contentStudio/articlesAddonSettingsService');
    const { settings } = await getArticlesAddonSettings(req.user.organizationId);
    const staleContent = evaluateStaleContent(data, settings.staleContentAlertDays);
    return res.json({ success: true, data: { ...data, staleContent } });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.updateArticle = async (req, res) => {
  try {
    const data = await contentDocumentService.saveContentDocumentDraft({
      organizationId: req.user.organizationId,
      id: req.params.id,
      title: req.body?.title,
      subtitle: req.body?.subtitle,
      summary: req.body?.summary,
      slug: req.body?.slug,
      visibility: req.body?.visibility,
      featured: req.body?.featured,
      blocks: req.body?.blocks,
      seo: req.body?.seo,
      collectionId: req.body?.collectionId,
      coverAssetId: req.body?.coverAssetId,
      presentation: req.body?.presentation,
      authorId: req.body?.authorId,
      authorName: req.body?.authorName,
      userId: req.user._id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.deleteArticle = async (req, res) => {
  try {
    const data = await contentDocumentService.deleteContentDocument({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.unpublishArticle = async (req, res) => {
  try {
    const data = await contentDocumentService.unpublishContentDocument({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.archiveArticle = async (req, res) => {
  try {
    const data = await contentDocumentService.archiveContentDocument({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.searchArticlesForAgent = async (req, res) => {
  try {
    const data = await contentDocumentService.searchAgentKnowledgeArticles({
      organizationId: req.user.organizationId,
      query: req.query.q || req.query.search,
      limit: req.query.limit,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.listArticleCollections = async (req, res) => {
  try {
    const data = await contentCollectionService.listContentCollections({
      organizationId: req.user.organizationId,
      addonKey: ADDON_KEYS.ARTICLES,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.createArticleCollection = async (req, res) => {
  try {
    const data = await contentCollectionService.createContentCollection({
      organizationId: req.user.organizationId,
      addonKey: ADDON_KEYS.ARTICLES,
      name: req.body?.name,
      slug: req.body?.slug,
      description: req.body?.description,
      emoji: req.body?.emoji,
      heroIconKey: req.body?.heroIconKey,
      heroIconColor: req.body?.heroIconColor,
      imageUrl: req.body?.imageUrl,
      parentId: req.body?.parentId,
      sortOrder: req.body?.sortOrder,
      userId: req.user._id,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.updateArticleCollection = async (req, res) => {
  try {
    const data = await contentCollectionService.updateContentCollection({
      organizationId: req.user.organizationId,
      id: req.params.collectionId,
      name: req.body?.name,
      slug: req.body?.slug,
      description: req.body?.description,
      emoji: req.body?.emoji,
      heroIconKey: req.body?.heroIconKey,
      heroIconColor: req.body?.heroIconColor,
      imageUrl: req.body?.imageUrl,
      parentId: req.body?.parentId,
      sortOrder: req.body?.sortOrder,
      userId: req.user._id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.deleteArticleCollection = async (req, res) => {
  try {
    const data = await contentCollectionService.deleteContentCollection({
      organizationId: req.user.organizationId,
      id: req.params.collectionId,
      userId: req.user._id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.publishArticle = async (req, res) => {
  try {
    const data = await contentDocumentService.publishContentDocument({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.listBlogPosts = async (req, res) => {
  try {
    const result = await contentDocumentService.listContentDocuments({
      organizationId: req.user.organizationId,
      addonKey: ADDON_KEYS.BLOG,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      collectionId: req.query.collectionId,
      visibility: req.query.visibility,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.createBlogPost = async (req, res) => {
  try {
    const data = await contentDocumentService.createContentDocument({
      organizationId: req.user.organizationId,
      addonKey: ADDON_KEYS.BLOG,
      title: req.body?.title,
      slug: req.body?.slug,
      summary: req.body?.summary,
      visibility: req.body?.visibility,
      featured: req.body?.featured,
      sticky: req.body?.sticky,
      tags: req.body?.tags,
      blocks: req.body?.blocks,
      collectionId: req.body?.collectionId,
      coverAssetId: req.body?.coverAssetId,
      presentation: req.body?.presentation,
      authorId: req.body?.authorId,
      authorName: req.body?.authorName,
      userId: req.user._id,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.getBlogPostAnalytics = async (req, res) => {
  try {
    const articleAnalyticsService = require('../services/contentStudio/articleAnalyticsService');
    const doc = await contentDocumentService.getContentDocumentById({
      organizationId: req.user.organizationId,
      id: req.params.id,
    });
    const analytics = await articleAnalyticsService.getArticleAnalytics({
      organizationId: req.user.organizationId,
      contentDocumentId: doc._id,
    });
    return res.json({ success: true, data: analytics });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.getBlogPost = async (req, res) => {
  try {
    const data = await contentDocumentService.getContentDocumentById({
      organizationId: req.user.organizationId,
      id: req.params.id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.updateBlogPost = async (req, res) => {
  try {
    const data = await contentDocumentService.saveContentDocumentDraft({
      organizationId: req.user.organizationId,
      id: req.params.id,
      title: req.body?.title,
      subtitle: req.body?.subtitle,
      summary: req.body?.summary,
      slug: req.body?.slug,
      visibility: req.body?.visibility,
      featured: req.body?.featured,
      sticky: req.body?.sticky,
      tags: req.body?.tags,
      blocks: req.body?.blocks,
      seo: req.body?.seo,
      collectionId: req.body?.collectionId,
      coverAssetId: req.body?.coverAssetId,
      presentation: req.body?.presentation,
      authorId: req.body?.authorId,
      authorName: req.body?.authorName,
      userId: req.user._id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.deleteBlogPost = async (req, res) => {
  try {
    const data = await contentDocumentService.deleteContentDocument({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.unpublishBlogPost = async (req, res) => {
  try {
    const data = await contentDocumentService.unpublishContentDocument({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.archiveBlogPost = async (req, res) => {
  try {
    const data = await contentDocumentService.archiveContentDocument({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.listBlogCollections = async (req, res) => {
  try {
    const data = await contentCollectionService.listContentCollections({
      organizationId: req.user.organizationId,
      addonKey: ADDON_KEYS.BLOG,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.createBlogCollection = async (req, res) => {
  try {
    const data = await contentCollectionService.createContentCollection({
      organizationId: req.user.organizationId,
      addonKey: ADDON_KEYS.BLOG,
      name: req.body?.name,
      slug: req.body?.slug,
      description: req.body?.description,
      emoji: req.body?.emoji,
      heroIconKey: req.body?.heroIconKey,
      heroIconColor: req.body?.heroIconColor,
      imageUrl: req.body?.imageUrl,
      parentId: req.body?.parentId,
      sortOrder: req.body?.sortOrder,
      userId: req.user._id,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.updateBlogCollection = async (req, res) => {
  try {
    const data = await contentCollectionService.updateContentCollection({
      organizationId: req.user.organizationId,
      id: req.params.collectionId,
      name: req.body?.name,
      slug: req.body?.slug,
      description: req.body?.description,
      emoji: req.body?.emoji,
      heroIconKey: req.body?.heroIconKey,
      heroIconColor: req.body?.heroIconColor,
      imageUrl: req.body?.imageUrl,
      parentId: req.body?.parentId,
      sortOrder: req.body?.sortOrder,
      userId: req.user._id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.deleteBlogCollection = async (req, res) => {
  try {
    const data = await contentCollectionService.deleteContentCollection({
      organizationId: req.user.organizationId,
      id: req.params.collectionId,
      userId: req.user._id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};

exports.publishBlogPost = async (req, res) => {
  try {
    const data = await contentDocumentService.publishContentDocument({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendContentStudioError(res, error);
  }
};
