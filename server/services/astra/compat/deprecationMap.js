'use strict';

/**
 * Cutover map after restore-v2-then-delete-old (2026-07-22).
 *
 * Conversational UX = Astra v2 only (`/astra` → GlobalCopilot, `/api/ai/v2`).
 *
 * FULL legacy-AI ability deletion (2026-07-22): all legacy ability services under
 * `server/services/ai/` were deleted. Only Astra v2 infra + AI settings + embed remain.
 * The legacy `/api/ai/*` router now exposes ONLY: status, audit-log, settings (GET/PUT),
 * settings/models, echo, echo/stream, embed/documents/:id, embed/content-documents/:id.
 * All other legacy `/api/ai/*` ability endpoints are gone — use Astra v2 (`/api/ai/v2`).
 */
module.exports = {
  status: 'legacy-ai-deleted',
  deleted: [
    'client/src/views/astra/AstraFullPage.vue',
    'client InProductSupportHub mount (GlobalSurfacesProvider)',
    'client AI panels: CasePropose, Commercial, DealQuote, Duplicates, FieldExtract, RecordResearch',
    'server/services/ai/astra/{orchestrator,intent,response,memory,reasoning,retrieval,eval,contracts}',
    'server/services/ai/astra/ (legacy planner + tools)',
    'ALL legacy ability services under server/services/ai/ (aiAgentService, aiAnalyticsIntentService, '
      + 'aiArivuCanvasService, aiAssistService, aiAstra* , aiAuditNarrativeService, aiClassifyService, '
      + 'aiCommercial*, aiConversationService, aiDigestBriefService, aiExtractService, aiFeedbackService, '
      + 'aiImportMappingService, aiKnowledgeService, aiLiveChatBotService, aiMarketingService, '
      + 'aiProcessDesignerService, aiRecordSummaryService, aiResponseCacheService, aiTenantAgentService, '
      + 'aiUserMemoryService, aiWebResearchService, aiWorkGraph*, astraAutopilotService, '
      + 'astraSuperAgentService, astraSuperAgentTriggers)',
    'Legacy /api/ai/* ability routes + aiController handlers (only status/audit-log/settings/'
      + 'settings-models/echo/echo-stream/embed retained)',
    'scheduledJobs Astra Autopilot + Super Agent schedulers',
  ],
  kept: [
    'server/services/ai/{adapters,providerRegistry,aiSettingsResolver,aiSettingsService,aiCreditService,'
      + 'aiAuditLogService,piiRedaction,errors,aiCircuitBreaker,aiEmbedService,aiEmbedQueueService,'
      + 'prompts/promptRegistry,vector,eval/goldenSets}',
    'server/routes/aiRoutes.js (settings + embed + echo + status/audit-log only)',
    'server/services/aiProcessActionHandlers.js (soft-fail stubs for process ai_classify/ai_extract)',
  ],
  primary: {
    ui: '/astra → client/src/astra/surfaces/GlobalCopilot.vue',
    api: '/api/ai/v2 → server/services/astra',
  },
};
