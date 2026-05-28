const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const controller = require('../controllers/settingsController');
const helpdeskSettingsController = require('../controllers/helpdeskSettingsController');
const assignmentRulesController = require('../controllers/assignmentRulesController');
const mailroomSettingsController = require('../controllers/mailroomSettingsController');
const { organizationSettingsLimiter } = require('../middleware/rateLimitMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const {
    cacheJsonResponse,
    invalidateCacheOnSuccessfulMutation,
} = require('../middleware/responseCacheMiddleware');

// All routes require authentication and organization context
router.use(protect);
router.use(organizationIsolation);

// Core Modules endpoints
router.get('/core-modules', controller.getCoreModules);
router.get('/core-modules/:moduleKey', controller.getCoreModule);
router.patch('/core-modules/:moduleKey/applications/:appKey', controller.toggleAppParticipation);

// Organization Status-Types endpoints (specific to organizations module)
router.get('/core-modules/organizations/status-types', controller.getOrganizationStatusTypes);
router.patch('/core-modules/organizations/status-types', controller.updateOrganizationStatusTypes);

// People types endpoint (tenant-configurable, e.g. Lead, Contact)
router.get('/core-modules/people/people-types/usage', controller.getPeopleTypesUsage);
router.get('/core-modules/people/people-types', controller.getPeopleTypes);
router.put('/core-modules/people/people-types', controller.updatePeopleTypes);

// Applications endpoints
router.get('/applications', cacheJsonResponse({ namespace: 'settings:applications' }), controller.getApplications);
router.get('/applications/helpdesk/execution-settings', helpdeskSettingsController.getHelpdeskExecutionSettings);
router.put('/applications/helpdesk/execution-settings', helpdeskSettingsController.updateHelpdeskExecutionSettings);
router.post('/applications/helpdesk/recalculate-slas', helpdeskSettingsController.recalculateOpenCaseSlas);
router.get('/applications/:appKey', controller.getApplication);

// Assignment Rules (Step 7A simulation foundation)
router.get('/automation/assignment-rules', assignmentRulesController.getAssignmentRuleSet);
router.put('/automation/assignment-rules', assignmentRulesController.upsertAssignmentRuleSet);
router.post('/automation/assignment-rules/simulate', assignmentRulesController.simulateAssignmentRules);

// Mailroom (conversation-first ingestion policies)
router.get('/automation/mailroom', mailroomSettingsController.getMailroomSettings);
router.put('/automation/mailroom', mailroomSettingsController.updateMailroomSettings);
router.get('/automation/mailroom/templates', mailroomSettingsController.listMailroomTemplates);
router.post('/automation/mailroom/evaluate', mailroomSettingsController.evaluateMailroomPolicies);
router.get('/automation/mailroom/conversations', mailroomSettingsController.listMailroomConversations);
router.get('/automation/mailroom/conversations/:id', mailroomSettingsController.getMailroomConversation);
router.get(
  '/automation/mailroom/conversations/:conversationId/attachments',
  mailroomSettingsController.listMailroomConversationAttachments
);
router.get(
  '/automation/mailroom/messages/:messageId/attachments',
  mailroomSettingsController.listMailroomMessageAttachments
);
router.get('/automation/mailroom/threading-logs', mailroomSettingsController.listMailroomThreadingLogs);
router.get('/automation/mailroom/failures', mailroomSettingsController.listMailroomProcessingFailures);
router.get('/automation/mailroom/metrics', mailroomSettingsController.getMailroomMetrics);
router.get('/automation/mailroom/routing-logs', mailroomSettingsController.listMailroomRoutingLogs);
router.get('/automation/mailroom/search', mailroomSettingsController.searchMailroom);
router.post('/automation/mailroom/failures/:rawPayloadId/replay', mailroomSettingsController.replayMailroomProcessingFailure);

// Subscriptions endpoints
router.get('/subscriptions', cacheJsonResponse({ namespace: 'settings:subscriptions' }), controller.getSubscriptions);
router.get('/subscriptions/:appKey', controller.getSubscription);

// Organization settings endpoints
router.get(
    '/organization',
    organizationSettingsLimiter,
    cacheJsonResponse({ namespace: 'settings:organization' }),
    controller.getOrganizationSettings
);
router.put(
    '/organization',
    invalidateCacheOnSuccessfulMutation({ namespace: 'settings:organization' }),
    controller.updateOrganizationSettings
);
router.post(
    '/organization/logo',
    invalidateCacheOnSuccessfulMutation({ namespace: 'settings:organization' }),
    uploadSingle('logo'),
    controller.uploadOrganizationLogo
);
router.delete(
    '/organization/logo',
    invalidateCacheOnSuccessfulMutation({ namespace: 'settings:organization' }),
    controller.deleteOrganizationLogo
);

// Security settings endpoints
router.get('/security', controller.getSecuritySettings);
router.put('/security', controller.updateSecuritySettings);
router.get('/security/activity', controller.getSecurityActivity);

// Integrations settings endpoints
router.get('/integrations', controller.getIntegrations);
router.get('/integrations/:key', controller.getIntegration);
router.post('/integrations/:key/enable', controller.enableIntegration);
router.post('/integrations/:key/disable', controller.disableIntegration);
router.post('/integrations/:key/test', controller.testIntegration);
router.put('/integrations/:key/config', controller.updateIntegrationConfig);

module.exports = router;
