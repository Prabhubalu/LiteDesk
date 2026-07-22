const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { requireAddonEntitlement } = require('../middleware/requireAddonEntitlementMiddleware');
const { requireLiveChatPermission } = require('../middleware/requireLiveChatPermissionMiddleware');
const { ADDON_KEYS } = require('../constants/addonKeys');
const liveChatSessionController = require('../controllers/liveChatSessionController');
const liveChatVisitorController = require('../controllers/liveChatVisitorController');
const liveChatQueueController = require('../controllers/liveChatQueueController');
const liveChatPresenceController = require('../controllers/liveChatPresenceController');
const liveChatReportController = require('../controllers/liveChatReportController');
const liveChatBotController = require('../controllers/liveChatBotController');
const liveChatWebsiteContentPageController = require('../controllers/liveChatWebsiteContentPageController');
const liveChatSessionFieldController = require('../controllers/liveChatSessionFieldController');
const liveChatInAppSupportController = require('../controllers/liveChatInAppSupportController');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const { createSettingsAuditMiddleware } = require('../middleware/settingsAuditMiddleware');

const settingsAddonAudit = createSettingsAuditMiddleware({ surface: 'addons' });

router.use(protect);
router.use(organizationIsolation);
router.use(requireAddonEntitlement(ADDON_KEYS.LIVE_CHAT));

// In-product support hub bootstrap (any entitled user — not agent-only).
router.get('/in-app-support', liveChatInAppSupportController.getInAppSupportBootstrap);

router.get('/reports/overview', requireLiveChatPermission('view'), liveChatReportController.getOverview);
router.get('/reports/agents', requireLiveChatPermission('view'), liveChatReportController.getAgentMetrics);
router.get('/bots', requireLiveChatPermission('admin'), liveChatBotController.listBots);
router.get(
  '/bots/deflection-metrics',
  requireLiveChatPermission('admin'),
  liveChatBotController.getDeflectionMetrics
);
router.post('/bots', requireLiveChatPermission('admin'), settingsAddonAudit, liveChatBotController.createBot);
router.get('/bots/:botId', requireLiveChatPermission('admin'), liveChatBotController.getBot);
router.put('/bots/:botId', requireLiveChatPermission('admin'), settingsAddonAudit, liveChatBotController.updateBot);
router.delete('/bots/:botId', requireLiveChatPermission('admin'), settingsAddonAudit, liveChatBotController.deleteBot);
router.get('/website-content', requireLiveChatPermission('admin'), liveChatWebsiteContentPageController.listPages);
router.post('/website-content', requireLiveChatPermission('admin'), settingsAddonAudit, liveChatWebsiteContentPageController.createPage);
router.get('/website-content/:pageId', requireLiveChatPermission('admin'), liveChatWebsiteContentPageController.getPage);
router.put('/website-content/:pageId', requireLiveChatPermission('admin'), settingsAddonAudit, liveChatWebsiteContentPageController.updatePage);
router.delete('/website-content/:pageId', requireLiveChatPermission('admin'), settingsAddonAudit, liveChatWebsiteContentPageController.deletePage);
router.get('/outcomes', requireLiveChatPermission('view'), liveChatSessionController.listOutcomes);
router.get('/presence/statuses', requireLiveChatPermission('view'), liveChatPresenceController.listPresenceStatuses);
router.get('/presence/me', requireLiveChatPermission('view'), liveChatPresenceController.getMyPresence);
router.put('/presence/me', requireLiveChatPermission('reply'), liveChatPresenceController.setMyPresence);
router.get('/queues/distribution-modes', requireLiveChatPermission('admin'), liveChatQueueController.listDistributionModes);
router.get('/queues', requireLiveChatPermission('admin'), liveChatQueueController.listQueues);
router.post('/queues', requireLiveChatPermission('admin'), settingsAddonAudit, liveChatQueueController.createQueue);
router.get('/queues/:queueId', requireLiveChatPermission('admin'), liveChatQueueController.getQueue);
router.put('/queues/:queueId', requireLiveChatPermission('admin'), settingsAddonAudit, liveChatQueueController.updateQueue);
router.delete('/queues/:queueId', requireLiveChatPermission('admin'), settingsAddonAudit, liveChatQueueController.deleteQueue);
router.get('/session-fields', requireLiveChatPermission('view'), liveChatSessionFieldController.getSessionFields);
router.get('/sessions', requireLiveChatPermission('view'), liveChatSessionController.listSessions);
router.get('/sessions/export', requireLiveChatPermission('admin'), liveChatSessionController.exportOrganizationTranscripts);
router.get('/visitors', requireLiveChatPermission('view'), liveChatVisitorController.listVisitors);
router.get('/visitors/:visitorId', requireLiveChatPermission('view'), liveChatVisitorController.getVisitor);
router.get('/sessions/:sessionId/notes', requireLiveChatPermission('view'), liveChatSessionController.listSessionNotes);
router.post('/sessions/:sessionId/notes', requireLiveChatPermission('reply'), liveChatSessionController.createSessionNote);
router.get('/sessions/:sessionId/journey', requireLiveChatPermission('view'), liveChatSessionController.listSessionJourney);
router.get('/sessions/:sessionId/assignment-events', requireLiveChatPermission('view'), liveChatSessionController.listAssignmentEvents);
router.get('/sessions/:sessionId', requireLiveChatPermission('view'), liveChatSessionController.getSession);
router.get('/sessions/:sessionId/linked-records', requireLiveChatPermission('view'), liveChatSessionController.getSessionLinkedRecords);
router.get('/sessions/:sessionId/messages', requireLiveChatPermission('view'), liveChatSessionController.listMessages);
router.get('/sessions/:sessionId/stream', requireLiveChatPermission('view'), liveChatSessionController.streamMessages);
router.post('/sessions/:sessionId/claim', requireLiveChatPermission('reply'), liveChatSessionController.claimSession);
router.post('/sessions/:sessionId/transfer', requireLiveChatPermission('reply'), liveChatSessionController.transferSession);
router.post(
  '/sessions/:sessionId/message-attachments',
  requireLiveChatPermission('reply'),
  uploadSingle('file'),
  liveChatSessionController.uploadMessageAttachment,
);
router.post('/sessions/:sessionId/messages', requireLiveChatPermission('reply'), liveChatSessionController.sendMessage);
router.post('/sessions/:sessionId/read', requireLiveChatPermission('view'), liveChatSessionController.markRead);
router.post('/sessions/:sessionId/typing', requireLiveChatPermission('reply'), liveChatSessionController.setTyping);
router.post('/sessions/:sessionId/create-case', requireLiveChatPermission('reply'), liveChatSessionController.createLinkedCase);
router.post('/sessions/:sessionId/link-case', requireLiveChatPermission('reply'), liveChatSessionController.linkExistingCase);
router.post('/sessions/:sessionId/create-lead', requireLiveChatPermission('reply'), liveChatSessionController.createLinkedLead);
router.post('/sessions/:sessionId/link-person', requireLiveChatPermission('reply'), liveChatSessionController.linkExistingPerson);
router.patch('/sessions/:sessionId', requireLiveChatPermission('reply'), liveChatSessionController.patchSession);
router.post('/sessions/:sessionId/archive', requireLiveChatPermission('admin'), liveChatSessionController.archiveSession);
router.get('/sessions/:sessionId/export', requireLiveChatPermission('admin'), liveChatSessionController.exportSessionTranscript);
router.post('/sessions/:sessionId/end', requireLiveChatPermission('reply'), liveChatSessionController.endSession);

module.exports = router;
