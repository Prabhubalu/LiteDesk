'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { requireAddonEntitlement } = require('../middleware/requireAddonEntitlementMiddleware');
const { requireTelephonyPermission } = require('../middleware/requireTelephonyPermissionMiddleware');
const { ADDON_KEYS } = require('../constants/addonKeys');
const { createSettingsAuditMiddleware } = require('../middleware/settingsAuditMiddleware');

const telephonyCallController = require('../controllers/telephonyCallController');
const telephonyProviderController = require('../controllers/telephonyProviderController');
const telephonyRecordingController = require('../controllers/telephonyRecordingController');
const telephonyPresenceController = require('../controllers/telephonyPresenceController');
const telephonyQueueController = require('../controllers/telephonyQueueController');
const telephonyIvrController = require('../controllers/telephonyIvrController');
const telephonyCampaignController = require('../controllers/telephonyCampaignController');
const telephonyAnalyticsController = require('../controllers/telephonyAnalyticsController');
const telephonyAiController = require('../controllers/telephonyAiController');

const settingsAddonAudit = createSettingsAuditMiddleware({ surface: 'addons' });

router.use(protect);
router.use(organizationIsolation);
router.use(requireAddonEntitlement(ADDON_KEYS.TELEPHONY));

// Presence
router.get('/presence/statuses', requireTelephonyPermission('view'), telephonyPresenceController.listPresenceStatuses);
router.get('/presence/me', requireTelephonyPermission('view'), telephonyPresenceController.getMyPresence);
router.put('/presence/me', requireTelephonyPermission('call'), telephonyPresenceController.setMyPresence);
router.get('/presence/agents', requireTelephonyPermission('view'), telephonyPresenceController.listAgents);

// Softphone / SSE
router.post('/client-token', requireTelephonyPermission('call'), telephonyCallController.createClientToken);
router.get('/stream', requireTelephonyPermission('view'), telephonyCallController.streamEvents);

// Calls
router.get('/calls', requireTelephonyPermission('view'), telephonyCallController.listCalls);
router.get('/calls/search', requireTelephonyPermission('view'), telephonyCallController.searchCalls);
router.post('/calls', requireTelephonyPermission('call'), telephonyCallController.placeCall);
router.get('/calls/:callId', requireTelephonyPermission('view'), telephonyCallController.getCall);
router.post('/calls/:callId/hangup', requireTelephonyPermission('call'), telephonyCallController.hangUp);
router.post('/calls/:callId/mute', requireTelephonyPermission('call'), telephonyCallController.mute);
router.post('/calls/:callId/hold', requireTelephonyPermission('call'), telephonyCallController.hold);
router.post('/calls/:callId/transfer', requireTelephonyPermission('call'), telephonyCallController.transfer);
router.post('/calls/:callId/notes', requireTelephonyPermission('call'), telephonyCallController.attachNotes);

// Providers
router.get('/providers', requireTelephonyPermission('admin'), telephonyProviderController.listProviders);
router.put('/providers', requireTelephonyPermission('admin'), settingsAddonAudit, telephonyProviderController.upsertProvider);
router.get('/providers/:providerKey/health', requireTelephonyPermission('admin'), telephonyProviderController.healthCheck);
router.get('/phone-numbers', requireTelephonyPermission('manage'), telephonyProviderController.listPhoneNumbers);

// Recordings
router.get('/recordings', requireTelephonyPermission('listen'), telephonyRecordingController.listRecordings);
router.get('/recordings/:recordingId', requireTelephonyPermission('listen'), telephonyRecordingController.getRecording);
router.get('/recordings/:recordingId/download', requireTelephonyPermission('download'), telephonyRecordingController.downloadRecording);

// Queues
router.get('/queues/strategies', requireTelephonyPermission('admin'), telephonyQueueController.listStrategies);
router.get('/queues', requireTelephonyPermission('admin'), telephonyQueueController.listQueues);
router.post('/queues', requireTelephonyPermission('admin'), settingsAddonAudit, telephonyQueueController.createQueue);
router.put('/queues/:queueId', requireTelephonyPermission('admin'), settingsAddonAudit, telephonyQueueController.updateQueue);
router.post('/queues/:queueId/pick-agent', requireTelephonyPermission('manage'), telephonyQueueController.pickAgent);

// IVR
router.get('/ivr', requireTelephonyPermission('admin'), telephonyIvrController.listFlows);
router.post('/ivr', requireTelephonyPermission('admin'), settingsAddonAudit, telephonyIvrController.createFlow);
router.get('/ivr/:flowId', requireTelephonyPermission('admin'), telephonyIvrController.getFlow);
router.put('/ivr/:flowId', requireTelephonyPermission('admin'), settingsAddonAudit, telephonyIvrController.updateFlow);
router.post('/ivr/:flowId/publish', requireTelephonyPermission('admin'), settingsAddonAudit, telephonyIvrController.publishFlow);
router.delete('/ivr/:flowId', requireTelephonyPermission('admin'), settingsAddonAudit, telephonyIvrController.deleteFlow);

// Campaigns
router.get('/campaigns', requireTelephonyPermission('manage'), telephonyCampaignController.listCampaigns);
router.post('/campaigns', requireTelephonyPermission('manage'), settingsAddonAudit, telephonyCampaignController.createCampaign);
router.get('/campaigns/:campaignId', requireTelephonyPermission('manage'), telephonyCampaignController.getCampaign);
router.put('/campaigns/:campaignId', requireTelephonyPermission('manage'), settingsAddonAudit, telephonyCampaignController.updateCampaign);
router.post('/campaigns/:campaignId/start', requireTelephonyPermission('manage'), telephonyCampaignController.startCampaign);
router.post('/campaigns/:campaignId/pause', requireTelephonyPermission('manage'), telephonyCampaignController.pauseCampaign);
router.post('/campaigns/:campaignId/resume', requireTelephonyPermission('manage'), telephonyCampaignController.resumeCampaign);
router.post('/campaigns/:campaignId/dial-next', requireTelephonyPermission('call'), telephonyCampaignController.dialNext);

// Analytics
router.get('/analytics/dashboard', requireTelephonyPermission('view'), telephonyAnalyticsController.getDashboard);
router.get('/analytics/reports', requireTelephonyPermission('view'), telephonyAnalyticsController.getReports);
router.post('/analytics/rollup', requireTelephonyPermission('admin'), telephonyAnalyticsController.rollup);

// AI
router.get('/calls/:callId/transcript', requireTelephonyPermission('ai'), telephonyAiController.getTranscript);
router.get('/calls/:callId/summary', requireTelephonyPermission('ai'), telephonyAiController.getSummary);
router.post('/calls/:callId/transcript', requireTelephonyPermission('ai'), telephonyAiController.requestTranscript);
router.post('/calls/:callId/summary', requireTelephonyPermission('ai'), telephonyAiController.requestSummary);
router.post('/calls/:callId/ai/generate', requireTelephonyPermission('ai'), telephonyAiController.generateNow);

module.exports = router;
