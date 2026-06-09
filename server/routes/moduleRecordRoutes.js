/**
 * Unified record API for all modules: activity, comments, neighbors, batch.
 * Used by ModuleRecordPage so one client pattern works for every module.
 *
 * POST /api/modules/:moduleKey/records/batch             - batch fetch by ids (for related-record enrichment)
 * GET  /api/modules/:moduleKey/records/:recordId/activity   - merged activity + comments
 * GET  /api/modules/:moduleKey/records/:recordId/comments  - comments only
 * POST /api/modules/:moduleKey/records/:recordId/comments  - create comment
 * GET  /api/modules/:moduleKey/records/:recordId/neighbors  - prev/next for navigation
 */
const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { checkPermissionFromParam } = require('../middleware/permissionMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const controller = require('../controllers/moduleRecordController');
const { sessionBootstrapLimiter } = require('../middleware/rateLimitMiddleware');

const router = express.Router();

router.use(protect);
router.use(resolveAppContext);
router.use(organizationIsolation);

// Batch must be before :recordId routes so "batch" is not captured as recordId
router.post(
  '/:moduleKey/records/batch',
  checkPermissionFromParam('moduleKey', 'view'),
  controller.getRecordsBatch
);
router.post(
  '/:moduleKey/records/bulk-delete',
  checkPermissionFromParam('moduleKey', 'delete'),
  controller.bulkDeleteRecords
);
router.patch(
  '/:moduleKey/records/bulk-update',
  checkPermissionFromParam('moduleKey', 'edit'),
  controller.bulkUpdateRecords
);

router.get(
  '/:moduleKey/records/:recordId/activity',
  sessionBootstrapLimiter,
  checkPermissionFromParam('moduleKey', 'view'),
  controller.getActivity
);
router.get(
  '/:moduleKey/records/:recordId/comments',
  sessionBootstrapLimiter,
  checkPermissionFromParam('moduleKey', 'view'),
  controller.getComments
);
router.post(
  '/:moduleKey/records/:recordId/comment-attachments',
  checkPermissionFromParam('moduleKey', 'edit'),
  uploadSingle('file'),
  controller.uploadCommentAttachment
);
router.post(
  '/:moduleKey/records/:recordId/comments',
  checkPermissionFromParam('moduleKey', 'edit'),
  controller.createComment
);
router.put(
  '/:moduleKey/records/:recordId/comments/:commentId',
  checkPermissionFromParam('moduleKey', 'edit'),
  controller.updateComment
);
router.post(
  '/:moduleKey/records/:recordId/comments/:commentId/reactions',
  checkPermissionFromParam('moduleKey', 'edit'),
  controller.toggleCommentReaction
);
router.post(
  '/:moduleKey/tags/delete',
  checkPermissionFromParam('moduleKey', 'edit'),
  controller.deleteTagFromModule
);
router.get(
  '/:moduleKey/records/:recordId/neighbors',
  sessionBootstrapLimiter,
  checkPermissionFromParam('moduleKey', 'view'),
  controller.getNeighbors
);
router.get(
  '/:moduleKey/records/:recordId/description-versions',
  sessionBootstrapLimiter,
  checkPermissionFromParam('moduleKey', 'view'),
  controller.getDescriptionVersions
);
router.post(
  '/:moduleKey/records/:recordId/description-versions/restore',
  checkPermissionFromParam('moduleKey', 'edit'),
  controller.restoreDescriptionVersion
);

module.exports = router;
