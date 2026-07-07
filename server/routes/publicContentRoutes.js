'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const publicContentController = require('../controllers/publicContentController');

const router = express.Router();

const publicContentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const publicRenderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const publicFeedbackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/render-blocks', publicRenderLimiter, publicContentController.renderPublicBlocks);

router.get('/:orgSlug/sitemap.xml', publicContentLimiter, publicContentController.getPublicHelpSitemap);
router.get('/:orgSlug/collections', publicContentLimiter, publicContentController.listPublicHelpCollections);
router.get('/:orgSlug/articles/recent', publicContentLimiter, publicContentController.listPublicRecentHelpArticles);
router.get('/:orgSlug/articles/popular', publicContentLimiter, publicContentController.listPublicPopularHelpArticles);
router.get('/:orgSlug/help/recent', publicContentLimiter, publicContentController.listPublicRecentHelpArticles);
router.get('/:orgSlug/help/popular', publicContentLimiter, publicContentController.listPublicPopularHelpArticles);
router.get('/:orgSlug/help', publicContentLimiter, publicContentController.listPublicHelpArticles);
router.get('/:orgSlug/help/:slug', publicContentLimiter, publicContentController.getPublicHelpArticle);
router.get('/:orgSlug/articles', publicContentLimiter, publicContentController.listPublicHelpArticles);
router.post(
  '/:orgSlug/articles/:slug/feedback',
  publicFeedbackLimiter,
  publicContentController.submitPublicArticleFeedback,
);
router.get('/:orgSlug/articles/:slug', publicContentLimiter, publicContentController.getPublicHelpArticle);

module.exports = router;
