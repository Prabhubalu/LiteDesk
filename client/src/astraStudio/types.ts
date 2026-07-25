/** Mirrors server/services/astraStudio/constants.js */

export const CANVAS_TYPES = [
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
] as const;

export type CanvasType = (typeof CANVAS_TYPES)[number];

export const CANVAS_STATUSES = ['draft', 'active', 'archived'] as const;
export type CanvasStatus = (typeof CANVAS_STATUSES)[number];

export const WIDGET_TYPES = [
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
  'ai.summary',
  'ai.insights',
  'ai.recommendations',
  'ai.risk',
  'ai.nba',
  'analytics.chart',
  'analytics.kpi',
  'analytics.leaderboard',
  'analytics.forecast',
  'analytics.funnel',
  'analytics.heatmap',
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
  'comms.email',
  'comms.meeting_notes',
  'comms.conversation_timeline',
  'comms.call_summary',
  'layout.section',
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

export interface WidgetFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  z?: number;
}

export interface CanvasFocusRef {
  moduleKey: string;
  recordId: string;
}

export interface CanvasWidgetBindings {
  moduleKey?: string;
  recordId?: string;
  recordIds?: string[];
  [key: string]: unknown;
}

export interface CanvasWidgetConfig {
  title?: string;
  body?: string;
  items?: Array<{ id?: string; label: string; done?: boolean }>;
  columns?: Array<{ id: string; title: string; cards?: Array<{ id: string; title: string }> }>;
  nodes?: Array<{ id: string; label: string }>;
  metrics?: Array<{ label: string; value: string | number }>;
  [key: string]: unknown;
}

export interface CanvasWidget {
  id: string;
  type: WidgetType | string;
  frame: WidgetFrame;
  config?: CanvasWidgetConfig;
  bindings?: CanvasWidgetBindings;
  collapsed?: boolean;
  sectionId?: string;
  ai?: Record<string, unknown>;
}

export interface CanvasLayoutMeta {
  cameraX?: number;
  cameraY?: number;
  zoom?: number;
  userArranged?: boolean;
  packed?: boolean;
}

export interface CanvasMeta {
  _id: string;
  title: string;
  canvasType: CanvasType | string;
  status: CanvasStatus | string;
  focus?: CanvasFocusRef[];
  layoutMeta?: CanvasLayoutMeta;
  createdAt?: string;
  updatedAt?: string;
}

export interface CanvasOp {
  op: string;
  widget?: CanvasWidget;
  widgetId?: string;
  frame?: Partial<WidgetFrame>;
  config?: Partial<CanvasWidgetConfig>;
  bindings?: CanvasWidgetBindings;
  collapsed?: boolean;
  section?: { id: string; title?: string; x?: number; y?: number };
  sectionId?: string;
  widgets?: CanvasWidget[];
}

export interface StudioPeer {
  clientId: number;
  user?: {
    id: string;
    name: string;
    color: string;
    canEdit?: boolean;
  };
  cursor?: { x: number; y: number };
}

export interface StudioTemplateMeta {
  canvasType: string;
  label?: string;
  description?: string;
}
