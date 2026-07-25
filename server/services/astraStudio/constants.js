'use strict';

/** Canvas type enums matching the Living Canvas PRD. */
const CANVAS_TYPES = Object.freeze([
  'meeting_preparation',
  'executive_report',
  'customer_360',
  'opportunity_war_room',
  'account_planning',
  'quarterly_business_review',
  'customer_success_plan',
  'renewal_workspace',
  'support_investigation',
  'project_workspace',
  'workflow_design',
  'brainstorming',
  'strategy_workspace',
  'blank',
]);

const CANVAS_STATUSES = Object.freeze(['draft', 'active', 'archived']);

const REVISION_REASONS = Object.freeze(['manual', 'ai', 'checkpoint', 'restore']);

const SHARE_ROLES = Object.freeze(['viewer', 'editor']);

/** Widget types allow-listed for AI generation and the palette. */
const WIDGET_TYPES = Object.freeze([
  // CRM
  'crm.deal',
  'crm.contact',
  'crm.organization',
  'crm.lead',
  'crm.case',
  'crm.quote',
  'crm.invoice',
  'crm.product',
  'crm.campaign',
  'crm.project',
  'crm.task',
  // AI
  'ai.summary',
  'ai.insights',
  'ai.recommendations',
  'ai.risk',
  'ai.nba',
  // Analytics
  'analytics.chart',
  'analytics.kpi',
  'analytics.leaderboard',
  'analytics.forecast',
  'analytics.funnel',
  'analytics.heatmap',
  // Visualization
  'viz.timeline',
  'viz.kanban',
  'viz.calendar',
  'viz.org_chart',
  'viz.relationship_graph',
  'viz.mind_map',
  'viz.process',
  'viz.bpmn',
  'viz.uml',
  'viz.whiteboard',
  // Content
  'content.rich_text',
  'content.markdown',
  'content.checklist',
  'content.table',
  'content.image',
  'content.video',
  'content.pdf',
  'content.code',
  'content.document',
  'content.embed',
  'content.sticky',
  // Communication
  'comms.email',
  'comms.meeting_notes',
  'comms.conversation_timeline',
  'comms.call_summary',
  // Layout
  'layout.section',
]);

module.exports = {
  CANVAS_TYPES,
  CANVAS_STATUSES,
  REVISION_REASONS,
  SHARE_ROLES,
  WIDGET_TYPES,
};
