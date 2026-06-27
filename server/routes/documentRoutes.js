const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const controller = require('../controllers/documentController');

router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.get('/summary', checkPermission('documents', 'view'), controller.getDocumentSummary);
router.get('/meta', checkPermission('documents', 'view'), controller.getDocumentsListMeta);
router.get('/knowledge-base', checkPermission('documents', 'view'), controller.getKnowledgeBaseDocuments);
router.get('/activity', checkPermission('documents', 'view'), controller.getDocumentActivity);
router.get('/favorites', checkPermission('documents', 'view'), controller.getFavoriteDocumentIds);
router.get('/search/semantic', checkPermission('documents', 'view'), controller.semanticSearchDocuments);

router
  .route('/')
  .get(checkPermission('documents', 'view'), controller.getDocuments)
  .post(checkPermission('documents', 'create'), controller.createDocument);

router.post('/upload', checkPermission('documents', 'create'), uploadSingle('file'), controller.uploadDocument);

router.get('/:id/versions', checkPermission('documents', 'view'), controller.listDocumentVersions);
router.get('/:id/rich-content-versions', checkPermission('documents', 'view'), controller.listRichContentVersions);
router.post('/:id/rich-content-versions/restore', checkPermission('documents', 'edit'), controller.restoreRichContentVersion);
router.post(
  '/:id/versions',
  checkPermission('documents', 'edit'),
  uploadSingle('file'),
  controller.uploadNewVersion
);
router.post(
  '/:id/versions/:versionNumber/restore',
  checkPermission('documents', 'edit'),
  controller.restoreDocumentVersion
);
router.get('/:id/download', checkPermission('documents', 'view'), controller.downloadDocument);
router.get('/:id/preview', checkPermission('documents', 'view'), controller.previewDocument);
router.post('/:id/favorite', checkPermission('documents', 'view'), controller.toggleDocumentFavorite);
router.post('/:id/reserve', checkPermission('documents', 'edit'), controller.reserveDocument);
router.delete('/:id/reserve', checkPermission('documents', 'edit'), controller.releaseReservation);
router.post('/:id/reserve/takeover', checkPermission('documents', 'edit'), controller.takeoverReservation);
router.post('/:id/reserve/notify', checkPermission('documents', 'edit'), controller.notifyReservationHolder);
router.get('/:id/presence', checkPermission('documents', 'view'), controller.getDocumentPresence);
router.post('/:id/presence/heartbeat', checkPermission('documents', 'view'), controller.heartbeatDocumentPresence);
router.delete('/:id/presence', checkPermission('documents', 'view'), controller.clearDocumentPresence);
router.get('/:id/conflicts', checkPermission('documents', 'view'), controller.listDocumentConflicts);
router.post('/:id/conflicts/:conflictId/resolve', checkPermission('documents', 'edit'), controller.resolveDocumentConflict);
router.post('/:id/external-link/check', checkPermission('documents', 'view'), controller.checkExternalLink);
router.post('/:id/link', checkPermission('documents', 'edit'), controller.linkDocument);
router.delete('/:id/link/:relationshipId', checkPermission('documents', 'edit'), controller.unlinkDocument);

router.get('/:id/comments', checkPermission('documents', 'view'), controller.listDocumentInlineComments);
router.post('/:id/comments', checkPermission('documents', 'edit'), controller.createDocumentInlineComment);
router.post('/:id/comments/:commentId/resolve', checkPermission('documents', 'edit'), controller.resolveDocumentInlineComment);
router.post('/:id/comments/:commentId/reopen', checkPermission('documents', 'edit'), controller.reopenDocumentInlineComment);

router.get('/:id/signatures', checkPermission('documents', 'view'), controller.listDocumentSignatureRequests);
router.post('/:id/signatures', checkPermission('documents', 'edit'), controller.createDocumentSignatureRequest);
router.post('/:id/signatures/:requestId/sign', checkPermission('documents', 'edit'), controller.signDocumentSignatureRequest);
router.post('/:id/signatures/:requestId/cancel', checkPermission('documents', 'edit'), controller.cancelDocumentSignatureRequest);

router.get('/:id/draft', checkPermission('documents', 'view'), controller.getDocumentEditDraft);
router.put('/:id/draft', checkPermission('documents', 'edit'), controller.saveDocumentEditDraft);
router.delete('/:id/draft', checkPermission('documents', 'edit'), controller.deleteDocumentEditDraft);
router.post('/:id/draft/publish', checkPermission('documents', 'edit'), controller.publishDocumentEditDraft);
router.get('/:id/drafts', checkPermission('documents', 'view'), controller.listDocumentEditDrafts);

router
  .route('/:id')
  .get(checkPermission('documents', 'view'), controller.getDocumentById)
  .patch(checkPermission('documents', 'edit'), controller.updateDocument)
  .delete(checkPermission('documents', 'delete'), controller.deleteDocument);

module.exports = router;
