'use strict';

/**
 * Astra intent → capability registry (configure once, reuse forever).
 * Intent detectors live in aiWorkGraphContextService / aiArivuCanvasService.
 */

const {
  isAttentionWorkQuestion,
  isCalendarScheduleQuestion,
  isContentCreationQuestion,
} = require('./aiWorkGraphContextService');
const {
  isCanvasCrmQuestion,
  isArivuCanvasQuestion,
} = require('./aiArivuCanvasService');
const { isReportBuilderQuestion, isCreateWidgetQuestion } = require('./aiAstraReportBuilderService');

/** @typedef {{ id: string, detect: (q: string) => boolean, promptRules: string[], preferredActions: string[], suppressCrmTaskCreate?: boolean, suppressWrites?: boolean }} AstraIntentCapability */

/** @type {AstraIntentCapability[]} */
const ASTRA_INTENT_CAPABILITIES = [
  {
    id: 'report_widget',
    detect: isCreateWidgetQuestion,
    promptRules: [
      'WIDGET INTENT: user wants an Analytics widget from an existing report (not a new report draft).',
      'Create/pin a real AnalyticsWidget bound to the prior report. Prefer open_widget / open_dashboard.',
    ],
    preferredActions: ['open_widget', 'open_dashboard', 'open_report'],
    suppressCrmTaskCreate: true,
    suppressWrites: true,
  },
  {
    id: 'report_builder',
    detect: isReportBuilderQuestion,
    promptRules: [
      'REPORT BUILDER INTENT: user wants a real Analytics report (create/build/save/share/schedule report), not a one-off chart glance.',
      'Do NOT open Arivu Canvas. Prefer open_report_builder / open_report / publish_report actions.',
      'The system creates an AnalyticsReport with inferred filters, joins, formulas, visibility, and schedule when named in the ask.',
    ],
    preferredActions: ['open_report_builder', 'open_report', 'publish_report', 'export_report', 'pin_report_to_dashboard'],
    suppressCrmTaskCreate: true,
    suppressWrites: true,
  },
  {
    id: 'attention_work',
    detect: isAttentionWorkQuestion,
    promptRules: [
      'ATTENTION INTENT: answer due today / overdue ONLY from the ATTENTION section when present.',
    ],
    preferredActions: ['complete_task', 'follow_up', 'review_record'],
  },
  {
    id: 'calendar_schedule',
    detect: isCalendarScheduleQuestion,
    promptRules: [
      'CALENDAR INTENT: answer meetings/events today and next meeting ONLY from CALENDAR MEETINGS when present. Never pick a past start as next.',
    ],
    preferredActions: ['review_record', 'follow_up', 'open_canvas'],
  },
  {
    id: 'arivu_canvas_crm',
    detect: isCanvasCrmQuestion,
    promptRules: [
      'ARIVU CANVAS (CRM) — Salesforce Generative Canvas style: open a live workspace with real CRM cards (stakeholders, opportunity analysis, meeting notes, conversation recap, KPIs).',
      'Do NOT answer with placeholder text about what the canvas will do. Emit action kind=open_canvas with fields.mode=crm.',
      'Do NOT create a task / prep notes record unless explicitly asked.',
    ],
    preferredActions: ['open_canvas', 'review_record', 'follow_up'],
    suppressCrmTaskCreate: true,
    suppressWrites: true,
  },
  {
    id: 'content_creation',
    detect: isContentCreationQuestion,
    promptRules: [
      'ARIVU CANVAS (PRESENTATION): User wants a deck/slides — open Generative Canvas in presentation mode with a real slide outline.',
      'ALWAYS emit a complete slide outline in detail (numbered slides + bullets). Never ask clarifying questions when meeting/contact is already known.',
      'Never put "awaiting your input", "Full slide outline ready", or meta product text into the answer — open_canvas instead.',
      'Emit action kind=open_canvas with fields.mode=presentation, fields.title, fields.outline.',
      'Do NOT default to Content Studio. Only open_content_studio if they explicitly ask for Content Studio.',
      'Only create_record tasks if they explicitly ask for a task/reminder.',
    ],
    preferredActions: ['open_canvas', 'talk_to_agent', 'manual'],
    suppressCrmTaskCreate: true,
    suppressWrites: true,
  },
];

function detectAstraIntentCapabilities(question = '') {
  const q = String(question || '');
  return ASTRA_INTENT_CAPABILITIES.filter((cap) => {
    try {
      return Boolean(cap.detect(q));
    } catch {
      return false;
    }
  });
}

function formatIntentCapabilityPromptRules(question = '') {
  return detectAstraIntentCapabilities(question).flatMap((cap) => cap.promptRules);
}

function intentSuppressesCrmWrites(question = '') {
  return detectAstraIntentCapabilities(question).some((cap) => cap.suppressWrites || cap.suppressCrmTaskCreate);
}

module.exports = {
  ASTRA_INTENT_CAPABILITIES,
  detectAstraIntentCapabilities,
  formatIntentCapabilityPromptRules,
  intentSuppressesCrmWrites,
  isArivuCanvasQuestion,
};
