const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { aiLimiter } = require('../middleware/rateLimitMiddleware');
const { requireAiAccess } = require('../middleware/requireAiAccessMiddleware');
const { requireAiSuiteEntitlement } = require('../middleware/requireAiSuiteEntitlementMiddleware');
const {
  getAiStatus,
  getAiSettings,
  getAiModels,
  putAiSettings,
  echoAi,
  echoAiStream,
  enqueueDocumentEmbedJob,
  enqueueContentDocumentEmbedJob,
  listAiAuditLogsHandler,
} = require('../controllers/aiController');
const { createSettingsAuditMiddleware } = require('../middleware/settingsAuditMiddleware');

router.use(protect);
router.use(resolveAppContext);
router.use(organizationIsolation);

router.get('/status', requireAiAccess('view'), getAiStatus);
router.get('/audit-log', requireAiAccess('view'), listAiAuditLogsHandler);
router.get('/settings', requireAiAccess('view'), getAiSettings);
router.get('/settings/models', requireAiAccess('view'), getAiModels);
router.put(
  '/settings',
  requireAiAccess('manage'),
  createSettingsAuditMiddleware({ surface: 'ai' }),
  putAiSettings
);

router.post('/echo', aiLimiter, requireAiAccess('use'), requireAiSuiteEntitlement(), echoAi);
router.post('/echo/stream', aiLimiter, requireAiAccess('use'), requireAiSuiteEntitlement(), echoAiStream);
router.post(
  '/embed/documents/:documentId',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  enqueueDocumentEmbedJob
);
router.post(
  '/embed/content-documents/:contentDocumentId',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  enqueueContentDocumentEmbedJob
);

module.exports = router;
