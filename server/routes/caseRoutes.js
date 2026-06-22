const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { requireHelpdeskApp } = require('../middleware/requireHelpdeskAppMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission, applySharingFilter } = require('../middleware/permissionMiddleware');
const {
  createCase,
  getCases,
  getCaseById,
  updateCase,
  deleteCase,
  updateCaseStatus,
  bulkUpdateCases,
  reopenCase,
  addCaseActivity,
  getCaseAnalyticsSummary,
  getCaseAnalyticsTrends,
  getCaseAnalyticsOwners,
  getCaseAnalyticsDistribution,
  getCaseAuditExport,
  ingestCaseChannelInteraction,
  getCaseLiveChatSession,
} = require('../controllers/caseController');
const { deprecateCaseChatApi } = require('../middleware/deprecateCaseChatApiMiddleware');
const { listCaseCannedResponses } = require('../controllers/caseCannedResponseController');

const router = express.Router();

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(requireHelpdeskApp);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.route('/')
  .post(checkPermission('cases', 'create'), createCase)
  .get(applySharingFilter('cases'), checkPermission('cases', 'view'), getCases);

router.post('/ingest/channel', checkPermission('cases', 'create'), ingestCaseChannelInteraction);
router.patch('/bulk/update', checkPermission('cases', 'edit'), bulkUpdateCases);
router.get('/analytics/summary', applySharingFilter('cases'), checkPermission('cases', 'view'), getCaseAnalyticsSummary);
router.get('/analytics/trends', applySharingFilter('cases'), checkPermission('cases', 'view'), getCaseAnalyticsTrends);
router.get('/analytics/owners', applySharingFilter('cases'), checkPermission('cases', 'view'), getCaseAnalyticsOwners);
router.get('/analytics/distribution', applySharingFilter('cases'), checkPermission('cases', 'view'), getCaseAnalyticsDistribution);
router.get('/analytics/audit-export', applySharingFilter('cases'), checkPermission('cases', 'view'), getCaseAuditExport);
router.get('/canned-responses', checkPermission('cases', 'view'), listCaseCannedResponses);
router.get('/:id/live-chat-session', checkPermission('cases', 'view'), getCaseLiveChatSession);
router.get('/:id', checkPermission('cases', 'view'), getCaseById);
router.put('/:id', checkPermission('cases', 'edit'), updateCase);
router.delete('/:id', checkPermission('cases', 'delete'), deleteCase);
router.patch('/:id/status', checkPermission('cases', 'edit'), updateCaseStatus);
router.post('/:id/reopen', checkPermission('cases', 'edit'), reopenCase);
router.post('/:id/activities', checkPermission('cases', 'edit'), addCaseActivity);

// Live Chat on cases — deprecated (Live Chat addon owns sessions).
router.get('/:id/chat/session', deprecateCaseChatApi);
router.get('/:id/chat/messages', deprecateCaseChatApi);
router.get('/:id/chat/stream', deprecateCaseChatApi);
router.post('/:id/chat/messages', deprecateCaseChatApi);
router.post('/:id/chat/read', deprecateCaseChatApi);
router.post('/:id/chat/typing', deprecateCaseChatApi);

module.exports = router;
