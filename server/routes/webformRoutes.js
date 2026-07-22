const express = require('express');
const {
  createWebform,
  getWebforms,
  getWebformById,
  updateWebform,
  deleteWebform,
  duplicateWebform,
  enablePublicLink,
  getWebformSubmissions,
  getWebformAnalytics,
  syncPublicRegistry,
  getWebformPreviewBySlug,
  getPublicWebformBySlug,
  submitPublicWebform,
  uploadPublicWebformFile,
  resolveWebformFillPreviewPayload
} = require('../controllers/webformController');

const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const {
  publicWebformViewLimiter,
  publicWebformSubmitLimiter
} = require('../middleware/rateLimitMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const { createSettingsAuditMiddleware } = require('../middleware/settingsAuditMiddleware');

const router = express.Router();

router.get('/:slug', publicWebformViewLimiter, getPublicWebformBySlug);
router.post('/:slug/upload', publicWebformSubmitLimiter, uploadSingle('file'), uploadPublicWebformFile);
router.post('/:slug/submit', publicWebformSubmitLimiter, submitPublicWebform);

const protectedRouter = express.Router();
protectedRouter.use(protect);
protectedRouter.use(organizationIsolation);
protectedRouter.use(checkTrialStatus);
protectedRouter.use(createSettingsAuditMiddleware({ surface: 'webforms', entityType: 'Webform' }));

protectedRouter.route('/')
  .get(checkPermission('webforms', 'view'), getWebforms)
  .post(checkPermission('webforms', 'create'), createWebform);

protectedRouter.post('/fill-preview-payload', checkPermission('webforms', 'view'), resolveWebformFillPreviewPayload);
protectedRouter.post('/:id/duplicate', checkPermission('webforms', 'create'), duplicateWebform);
protectedRouter.post('/:id/enable-public', checkPermission('webforms', 'edit'), enablePublicLink);
protectedRouter.post('/:id/sync-public-registry', checkPermission('webforms', 'edit'), syncPublicRegistry);
protectedRouter.get('/preview-by-slug/:slug', getWebformPreviewBySlug);
protectedRouter.get('/:id/analytics', checkPermission('webforms', 'view'), getWebformAnalytics);
protectedRouter.get('/:id/submissions', checkPermission('webforms', 'view'), getWebformSubmissions);

protectedRouter.route('/:id')
  .get(checkPermission('webforms', 'view'), getWebformById)
  .put(checkPermission('webforms', 'edit'), updateWebform)
  .delete(checkPermission('webforms', 'delete'), deleteWebform);

const webformRoutes = router;
webformRoutes.protected = protectedRouter;
module.exports = webformRoutes;
