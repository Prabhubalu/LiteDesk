'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requirePlatformAdmin } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/platformAmdsInfraController');

router.use(protect);
router.use(requirePlatformAdmin());

router.get('/infra/status', controller.getInfraStatus);

module.exports = router;
