'use strict';

const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { requireMarketingApp } = require('../middleware/requireMarketingAppMiddleware');
const { requireAddonEntitlement } = require('../middleware/requireAddonEntitlementMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const { ADDON_KEYS } = require('../constants/addonKeys');
const controller = require('../controllers/contentStudioController');

const router = express.Router();

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(requireMarketingApp);
router.use(requireAddonEntitlement(ADDON_KEYS.BLOG));
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.get('/collections', checkPermission('blog', 'view'), controller.listBlogCollections);
router.post('/collections', checkPermission('blog', 'create'), controller.createBlogCollection);
router.patch('/collections/:collectionId', checkPermission('blog', 'edit'), controller.updateBlogCollection);
router.delete('/collections/:collectionId', checkPermission('blog', 'delete'), controller.deleteBlogCollection);

router.get('/', checkPermission('blog', 'view'), controller.listBlogPosts);
router.post('/', checkPermission('blog', 'create'), controller.createBlogPost);
router.get('/:id/analytics', checkPermission('blog', 'view'), controller.getBlogPostAnalytics);
router.get('/:id', checkPermission('blog', 'view'), controller.getBlogPost);
router.patch('/:id', checkPermission('blog', 'edit'), controller.updateBlogPost);
router.delete('/:id', checkPermission('blog', 'delete'), controller.deleteBlogPost);
router.post('/:id/publish', checkPermission('blog', 'publish'), controller.publishBlogPost);
router.post('/:id/unpublish', checkPermission('blog', 'publish'), controller.unpublishBlogPost);
router.post('/:id/archive', checkPermission('blog', 'edit'), controller.archiveBlogPost);

module.exports = router;
