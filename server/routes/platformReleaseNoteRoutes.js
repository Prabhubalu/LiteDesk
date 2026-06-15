'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requirePlatformAdmin } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/platformReleaseNoteController');

router.use(protect);
router.use(requirePlatformAdmin());

router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id/stats', controller.stats);
router.get('/:id/audience-preview', controller.audiencePreview);
router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.archive);
router.post('/:id/publish', controller.publish);
router.post('/:id/schedule', controller.schedule);

module.exports = router;
