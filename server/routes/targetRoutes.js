'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const controller = require('../controllers/targetController');

router.use(protect);
router.use(organizationIsolation);

router.get('/summary', controller.getTargetSummary);
router.get('/types', controller.listTargetTypes);
router.post('/types', controller.upsertTargetType);
router.post('/types/seed', controller.seedTargetTypes);
router.get('/lifecycle-options', controller.getLifecycleOptions);
router.get('/leaderboard', controller.getLeaderboard);
router.get('/platform-settings', controller.getPlatformSettings);
router.patch('/platform-settings', controller.updatePlatformSettings);

router.post('/conflicts/check', controller.checkConflicts);

router.get('/', controller.listTargets);
router.post('/', controller.createTarget);
router.get('/:id', controller.getTargetById);
router.patch('/:id', controller.updateTarget);
router.post('/:id/activate', controller.activateTarget);
router.post('/:id/lock', controller.lockTarget);
router.post('/:id/complete', controller.completeTarget);
router.post('/:id/close', controller.closeTarget);
router.get('/:id/assignments', controller.getAssignments);
router.get('/:id/contributions', controller.getContributions);
router.get('/:id/forecast', controller.getForecast);
router.get('/:id/versions', controller.listVersions);
router.post('/:id/redistribute', controller.redistributeTarget);
router.post('/:id/recalculate', controller.recalculateTarget);

module.exports = router;
