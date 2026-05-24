'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requirePlatformAdmin } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/platformInboundParserController');

router.use(protect);
router.use(requirePlatformAdmin());

router.get('/', controller.getConfig);
router.put('/', controller.updateConfig);
router.post('/test-connection', controller.testConnection);

module.exports = router;
