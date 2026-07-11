'use strict';

const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { requireHelpdeskApp } = require('../middleware/requireHelpdeskAppMiddleware');
const { requireAddonEntitlement } = require('../middleware/requireAddonEntitlementMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const { ADDON_KEYS } = require('../constants/addonKeys');
const controller = require('../controllers/contentStudioController');

const router = express.Router();

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(requireHelpdeskApp);
router.use(requireAddonEntitlement(ADDON_KEYS.ARTICLES));
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.get('/collections', checkPermission('articles', 'view'), controller.listArticleCollections);
router.post('/collections', checkPermission('articles', 'create'), controller.createArticleCollection);
router.patch('/collections/:collectionId', checkPermission('articles', 'edit'), controller.updateArticleCollection);
router.delete('/collections/:collectionId', checkPermission('articles', 'delete'), controller.deleteArticleCollection);

router.get('/search', checkPermission('articles', 'view'), controller.searchArticlesForAgent);

router.get('/', checkPermission('articles', 'view'), controller.listArticles);
router.post('/', checkPermission('articles', 'create'), controller.createArticle);
router.get('/:id/analytics', checkPermission('articles', 'view'), controller.getArticleAnalytics);
router.get('/:id', checkPermission('articles', 'view'), controller.getArticle);
router.patch('/:id', checkPermission('articles', 'edit'), controller.updateArticle);
router.delete('/:id', checkPermission('articles', 'delete'), controller.deleteArticle);
router.post('/:id/publish', checkPermission('articles', 'publish'), controller.publishArticle);
router.post('/:id/unpublish', checkPermission('articles', 'publish'), controller.unpublishArticle);
router.post('/:id/archive', checkPermission('articles', 'edit'), controller.archiveArticle);

module.exports = router;
