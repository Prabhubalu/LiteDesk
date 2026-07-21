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
  summarizeCaseAi,
  summarizeDealAi,
  summarizePeopleAi,
  draftCaseReplyAi,
  askKnowledgeAi,
  submitAiFeedback,
  draftDealQuoteAi,
  briefOverdueInvoicesAi,
  askWorkGraphAi,
  researchRecordAi,
  extractFieldsAi,
  classifyTextAi,
  suggestCasePolicyAi,
  proposeInboxTriageAi,
  proposeCaseResolutionAi,
  suggestPeopleDuplicatesAi,
  suggestOrganizationDuplicatesAi,
  assistCampaignSubjectAi,
  assistCampaignBodyAi,
  summarizeCampaignAi,
  suggestImportMappingAi,
  suggestAnalyticsIntentAi,
  previewLiveChatFaqAi,
  draftAuditNarrativeAi,
  previewDigestBriefAi,
  proposeCommercialAgentAi,
  proposeCollectionAgentAi,
  generateProcessDesignerAi,
  listTenantAgentsAi,
  createTenantAgentAi,
  updateTenantAgentAi,
  deleteTenantAgentAi,
  askTenantAgentAi,
  applyAstraMutationAi,
  verifyAstraMutationAi,
  getAstraUserMemoryAi,
  putAstraUserMemoryAi,
  listAstraSkillsAi,
  runAstraSkillAi,
  listAstraChatModelsAi,
  listAstraSuperAgentsAi,
  getAstraNextBestActionsAi,
  listAstraAutopilotProposalsAi,
  acceptAstraAutopilotProposalAi,
  dismissAstraAutopilotProposalAi,
  refreshAstraAutopilotAi,
  suggestTenantAgentTriggersAi,
  listAiConversations,
  getAiConversation,
  createAiConversation,
  updateAiConversation,
  deleteAiConversation,
  listAiAuditLogsHandler,
} = require('../controllers/aiController');

router.use(protect);
router.use(resolveAppContext);
router.use(organizationIsolation);

router.get('/status', requireAiAccess('view'), getAiStatus);
router.get('/audit-log', requireAiAccess('view'), listAiAuditLogsHandler);
router.get('/settings', requireAiAccess('view'), getAiSettings);
router.get('/settings/models', requireAiAccess('view'), getAiModels);
router.put('/settings', requireAiAccess('manage'), putAiSettings);

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
router.post('/ask', aiLimiter, requireAiAccess('use'), requireAiSuiteEntitlement(), askKnowledgeAi);
router.post('/ask-graph', aiLimiter, requireAiAccess('use'), requireAiSuiteEntitlement(), askWorkGraphAi);

router.get('/conversations', requireAiAccess('use'), requireAiSuiteEntitlement(), listAiConversations);
router.post('/conversations', requireAiAccess('use'), requireAiSuiteEntitlement(), createAiConversation);
router.get('/conversations/:conversationId', requireAiAccess('use'), requireAiSuiteEntitlement(), getAiConversation);
router.put('/conversations/:conversationId', requireAiAccess('use'), requireAiSuiteEntitlement(), updateAiConversation);
router.delete('/conversations/:conversationId', requireAiAccess('use'), requireAiSuiteEntitlement(), deleteAiConversation);

router.get('/tenant-agents', requireAiAccess('view'), listTenantAgentsAi);
router.post(
  '/tenant-agents/ask',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  askTenantAgentAi
);
router.post(
  '/astra/mutations/apply',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  applyAstraMutationAi
);
router.post(
  '/astra/mutations/verify',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  verifyAstraMutationAi
);
router.get(
  '/astra/memory',
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  getAstraUserMemoryAi
);
router.put(
  '/astra/memory',
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  putAstraUserMemoryAi
);
router.get(
  '/astra/skills',
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  listAstraSkillsAi
);
router.get(
  '/astra/skills/:skillId',
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  runAstraSkillAi
);
router.get(
  '/astra/chat-models',
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  listAstraChatModelsAi
);
router.get(
  '/astra/super-agents',
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  listAstraSuperAgentsAi
);
router.get(
  '/astra/next-best-actions',
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  getAstraNextBestActionsAi
);
router.get(
  '/astra/autopilot/proposals',
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  listAstraAutopilotProposalsAi
);
router.post(
  '/astra/autopilot/refresh',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  refreshAstraAutopilotAi
);
router.post(
  '/astra/autopilot/proposals/:proposalId/accept',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  acceptAstraAutopilotProposalAi
);
router.post(
  '/astra/autopilot/proposals/:proposalId/dismiss',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  dismissAstraAutopilotProposalAi
);
router.post(
  '/tenant-agents/suggest-triggers',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  suggestTenantAgentTriggersAi
);
router.post('/tenant-agents', requireAiAccess('manage'), createTenantAgentAi);
router.put('/tenant-agents/:agentId', requireAiAccess('manage'), updateTenantAgentAi);
router.delete('/tenant-agents/:agentId', requireAiAccess('manage'), deleteTenantAgentAi);
router.post('/research', aiLimiter, requireAiAccess('use'), requireAiSuiteEntitlement(), researchRecordAi);
router.post('/extract-fields', aiLimiter, requireAiAccess('use'), requireAiSuiteEntitlement(), extractFieldsAi);
router.post('/classify', aiLimiter, requireAiAccess('use'), requireAiSuiteEntitlement(), classifyTextAi);
router.post(
  '/agents/inbox-triage',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  proposeInboxTriageAi
);
router.post(
  '/cases/:caseId/policy-suggest',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  suggestCasePolicyAi
);
router.post(
  '/cases/:caseId/resolution-propose',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  proposeCaseResolutionAi
);
router.post(
  '/marketing/subject-assist',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  assistCampaignSubjectAi
);
router.post(
  '/marketing/body-assist',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  assistCampaignBodyAi
);
router.post(
  '/marketing/campaigns/:campaignId/summarize',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  summarizeCampaignAi
);
router.post(
  '/audit/responses/:responseId/narrative',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  draftAuditNarrativeAi
);
router.post(
  '/digests/brief-preview',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  previewDigestBriefAi
);
router.post(
  '/agents/commercial/:dealId',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  proposeCommercialAgentAi
);
router.post(
  '/agents/collection',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  proposeCollectionAgentAi
);
router.post(
  '/live-chat/faq-preview',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  previewLiveChatFaqAi
);
router.post(
  '/analytics/intent-suggest',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  suggestAnalyticsIntentAi
);
router.post(
  '/import/mapping-suggest',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  suggestImportMappingAi
);
router.post(
  '/processes/generate',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  generateProcessDesignerAi
);
router.post('/feedback', aiLimiter, requireAiAccess('use'), requireAiSuiteEntitlement(), submitAiFeedback);

router.post(
  '/cases/:caseId/summarize',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  summarizeCaseAi
);
router.post(
  '/deals/:dealId/summarize',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  summarizeDealAi
);
router.post(
  '/deals/:dealId/quote-draft',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  draftDealQuoteAi
);
router.post(
  '/people/:peopleId/summarize',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  summarizePeopleAi
);
router.post(
  '/people/:peopleId/duplicates',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  suggestPeopleDuplicatesAi
);
router.post(
  '/organizations/:organizationRefId/duplicates',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  suggestOrganizationDuplicatesAi
);
router.post(
  '/cases/:caseId/draft-reply',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  draftCaseReplyAi
);
router.post(
  '/invoices/overdue-brief',
  aiLimiter,
  requireAiAccess('use'),
  requireAiSuiteEntitlement(),
  briefOverdueInvoicesAi
);

module.exports = router;
