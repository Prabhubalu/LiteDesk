'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const {
  requireAstraV2Enabled,
  requireAstraV2Access,
} = require('../middleware/requireAstraV2AccessMiddleware');
const { requireAstraStudioEnabled } = require('../middleware/requireAstraStudioMiddleware');
const controller = require('../controllers/astraStudioController');

router.use(protect);
router.use(resolveAppContext);
router.use(organizationIsolation);
router.use(requireAstraV2Enabled);
router.use(requireAstraStudioEnabled);

router.get('/status', requireAstraV2Access('view'), controller.getStatus);
router.get('/canvases', requireAstraV2Access('use'), controller.listCanvases);
router.post('/canvases', requireAstraV2Access('use'), controller.createCanvas);
router.get('/canvases/:canvasId', requireAstraV2Access('use'), controller.getCanvas);
router.patch('/canvases/:canvasId', requireAstraV2Access('use'), controller.updateCanvas);
router.post('/canvases/:canvasId/hydrate', requireAstraV2Access('use'), controller.hydrateCanvasEndpoint);
router.delete('/canvases/:canvasId', requireAstraV2Access('use'), controller.deleteCanvas);
router.put('/canvases/:canvasId/sharing', requireAstraV2Access('use'), controller.updateSharing);
router.post('/canvases/:canvasId/ops', requireAstraV2Access('use'), controller.applyOps);

router.get('/canvases/:canvasId/revisions', requireAstraV2Access('use'), controller.listRevisions);
router.post('/canvases/:canvasId/revisions', requireAstraV2Access('use'), controller.createRevision);
router.post(
  '/canvases/:canvasId/revisions/:versionNumber/restore',
  requireAstraV2Access('use'),
  controller.restoreRevision
);

router.get('/canvases/:canvasId/suggestions', requireAstraV2Access('use'), controller.listSuggestions);
router.post(
  '/canvases/:canvasId/suggestions/:suggestionId/resolve',
  requireAstraV2Access('use'),
  controller.resolveSuggestion
);

router.get('/canvases/:canvasId/comments', requireAstraV2Access('use'), controller.listComments);
router.post('/canvases/:canvasId/comments', requireAstraV2Access('use'), controller.createComment);

router.post('/canvases/:canvasId/export', requireAstraV2Access('use'), controller.exportCanvas);

module.exports = router;
