'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const controller = require('../controllers/releaseNoteController');

router.use(protect);

router.get('/unseen', controller.getUnseen);
router.get('/badge', controller.getBadge);
router.get('/history', controller.getHistory);
router.post('/snooze', controller.snooze);
router.post('/view-batch', controller.markViewedBatch);
router.post('/:id/view', controller.markViewed);

module.exports = router;
