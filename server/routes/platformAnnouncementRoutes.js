'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requirePlatformAdmin } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/platformAnnouncementController');

router.use(protect);
router.use(requirePlatformAdmin());

router.get('/presets', controller.listPresets);
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.post('/:id/publish', controller.publish);
router.post('/:id/pause', controller.pause);
router.delete('/:id', controller.archive);

module.exports = router;
