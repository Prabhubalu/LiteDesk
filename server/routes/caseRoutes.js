const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { requireHelpdeskApp } = require('../middleware/requireHelpdeskAppMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission, filterByOwnership } = require('../middleware/permissionMiddleware');
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
  ingestCaseChannelInteraction
} = require('../controllers/caseController');
const {
  getCaseChatSession,
  listCaseChatMessages,
  sendCaseChatMessage,
  setCaseChatTyping,
  streamCaseChatMessages
} = require('../controllers/caseChatController');

const router = express.Router();

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(requireHelpdeskApp);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.route('/')
  .post(checkPermission('cases', 'create'), createCase)
  .get(filterByOwnership('cases'), checkPermission('cases', 'view'), getCases);

router.post('/ingest/channel', checkPermission('cases', 'create'), ingestCaseChannelInteraction);
router.patch('/bulk/update', checkPermission('cases', 'edit'), bulkUpdateCases);
router.get('/analytics/summary', filterByOwnership('cases'), checkPermission('cases', 'view'), getCaseAnalyticsSummary);
router.get('/analytics/trends', filterByOwnership('cases'), checkPermission('cases', 'view'), getCaseAnalyticsTrends);
router.get('/analytics/owners', filterByOwnership('cases'), checkPermission('cases', 'view'), getCaseAnalyticsOwners);
router.get('/analytics/distribution', filterByOwnership('cases'), checkPermission('cases', 'view'), getCaseAnalyticsDistribution);
router.get('/analytics/audit-export', filterByOwnership('cases'), checkPermission('cases', 'view'), getCaseAuditExport);
router.get('/:id', checkPermission('cases', 'view'), getCaseById);
router.put('/:id', checkPermission('cases', 'edit'), updateCase);
router.delete('/:id', checkPermission('cases', 'delete'), deleteCase);
router.patch('/:id/status', checkPermission('cases', 'edit'), updateCaseStatus);
router.post('/:id/reopen', checkPermission('cases', 'edit'), reopenCase);
router.post('/:id/activities', checkPermission('cases', 'edit'), addCaseActivity);

// Live Chat inside cases (realtime via SSE).
router.get('/:id/chat/session', checkPermission('cases', 'view'), getCaseChatSession);
router.get('/:id/chat/messages', checkPermission('cases', 'view'), listCaseChatMessages);
router.get('/:id/chat/stream', checkPermission('cases', 'view'), streamCaseChatMessages);
router.post('/:id/chat/messages', checkPermission('cases', 'edit'), sendCaseChatMessage);
router.post('/:id/chat/typing', checkPermission('cases', 'edit'), setCaseChatTyping);

module.exports = router;
