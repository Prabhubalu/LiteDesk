'use strict';

const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { requireMarketingApp } = require('../middleware/requireMarketingAppMiddleware');
const { requireAddonEntitlement } = require('../middleware/requireAddonEntitlementMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
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

router.get('/', controller.listBlogPosts);
router.post('/', controller.createBlogPost);
router.get('/:id', controller.getBlogPost);
router.patch('/:id', controller.updateBlogPost);
router.post('/:id/publish', controller.publishBlogPost);

module.exports = router;
