'use strict';

const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const controller = require('../controllers/contentStudioController');

const router = express.Router();

router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.get('/block-registry', controller.getBlockRegistry);
router.post('/render-preview', controller.renderPreview);

module.exports = router;
