'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requirePlatformAdmin } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/platformAiSettingsController');

router.use(protect);
router.use(requirePlatformAdmin());

router.get('/', controller.getConfig);
router.put('/', controller.updateConfig);

module.exports = router;
