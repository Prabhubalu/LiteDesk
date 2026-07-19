export const ARIVU_CANVAS_STORAGE_KEY = 'arivu:canvas-doc';

export type ArivuCanvasMode = 'crm' | 'presentation';

export interface ArivuCanvasBlock {
  id?: string;
  component: string;
  title?: string;
  chartType?: string;
  metricLabel?: string;
  tone?: string;
  body?: string;
  items?: Array<{ label?: string; value?: string | number; hint?: string; max?: number }>;
  columns?: string[];
  rows?: Array<Array<string | number>>;
  points?: Array<{ label?: string; value?: number }>;
}

export interface ArivuCanvasSlide {
  id: string;
  title: string;
  bullets: string[];
}

export interface ArivuCanvasOpportunity {
  id: string;
  moduleKey: string;
  recordId: string;
  label: string;
  reason?: string;
}

export interface ArivuCanvasStarter {
  id: string;
  text: string;
}

export interface ArivuCanvasAction {
  label: string;
  kind: string;
  moduleKey?: string;
  recordId?: string;
  fields?: Record<string, string | number | boolean>;
  priority?: string;
  rationale?: string;
  prompt?: string;
  email?: { to?: string; subject?: string; body?: string };
}

export interface ArivuCanvasKpi {
  label: string;
  value: string;
  hint?: string;
  source?: string;
}

export interface ArivuCanvasCardPerson {
  recordId?: string;
  moduleKey?: string;
  name: string;
  title?: string;
  email?: string;
  company?: string;
  initials?: string;
}

export interface ArivuCanvasCard {
  id: string;
  type: 'stakeholders' | 'opportunity_analysis' | 'meeting_notes' | 'conversation_recap' | string;
  title: string;
  collapsible?: boolean;
  people?: ArivuCanvasCardPerson[];
  recap?: string;
  opportunityName?: string;
  fields?: Array<{ label: string; value: string }>;
  links?: Array<{ moduleKey: string; recordId: string; label: string }>;
  goals?: string[];
  topics?: string[];
  items?: Array<{ who?: string; body?: string; when?: string; initials?: string }>;
  actions?: ArivuCanvasAction[];
}

export interface ArivuCanvasWidgetRecord {
  recordId?: string;
  moduleKey?: string;
  label: string;
  subtitle?: string;
  initials?: string;
}

export interface ArivuCanvasWidget {
  id: string;
  type: 'kpi_strip' | 'record_list' | 'detail' | 'notes' | 'timeline' | 'chart' | string;
  title: string;
  moduleKey?: string;
  items?: Array<{ label?: string; value?: string | number; hint?: string; who?: string; body?: string; when?: string; initials?: string }>;
  records?: ArivuCanvasWidgetRecord[];
  headline?: string;
  body?: string;
  fields?: Array<{ label: string; value: string }>;
  links?: Array<{ moduleKey: string; recordId: string; label: string }>;
  sections?: Array<{ label: string; items: string[] }>;
  actions?: ArivuCanvasAction[];
  points?: Array<{ label?: string; value?: number }>;
  chartType?: string;
}

export interface ArivuCanvasDocument {
  version: number;
  mode: ArivuCanvasMode;
  title: string;
  subtitle?: string;
  summary?: string;
  heroSummary?: string;
  kpis?: ArivuCanvasKpi[];
  widgets?: ArivuCanvasWidget[];
  cards?: ArivuCanvasCard[];
  suggestedPrompts?: string[];
  conversationStarters?: ArivuCanvasStarter[];
  opportunities?: ArivuCanvasOpportunity[];
  blocks?: ArivuCanvasBlock[];
  slides?: ArivuCanvasSlide[];
  actions?: ArivuCanvasAction[];
  sourceQuestion?: string;
  createdAt?: string;
}

export function stashArivuCanvasDocument(doc: ArivuCanvasDocument): string {
  const id = `canvas-${Date.now().toString(36)}`;
  try {
    sessionStorage.setItem(`${ARIVU_CANVAS_STORAGE_KEY}:${id}`, JSON.stringify(doc));
    sessionStorage.setItem(ARIVU_CANVAS_STORAGE_KEY, JSON.stringify({ id, ...doc }));
  } catch {
    // ignore quota / private mode
  }
  return id;
}

export function persistArivuCanvasDocument(canvasId: string, doc: ArivuCanvasDocument): void {
  if (!canvasId || !doc) return;
  try {
    sessionStorage.setItem(`${ARIVU_CANVAS_STORAGE_KEY}:${canvasId}`, JSON.stringify(doc));
    sessionStorage.setItem(ARIVU_CANVAS_STORAGE_KEY, JSON.stringify({ id: canvasId, ...doc }));
  } catch {
    // ignore
  }
}

export function consumeArivuCanvasDocument(canvasId?: string | null): ArivuCanvasDocument | null {
  try {
    const key = canvasId
      ? `${ARIVU_CANVAS_STORAGE_KEY}:${canvasId}`
      : ARIVU_CANVAS_STORAGE_KEY;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    // Keep stash so refresh / improvise can re-read; only remove generic key when no id
    if (!canvasId) sessionStorage.removeItem(ARIVU_CANVAS_STORAGE_KEY);
    const parsed = JSON.parse(raw) as ArivuCanvasDocument & { id?: string };
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseCanvasFromActionFields(
  fields?: Record<string, unknown> | null,
): ArivuCanvasDocument | null {
  if (!fields || typeof fields !== 'object') return null;
  const raw = fields.canvasJson || fields.canvas;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return JSON.parse(raw) as ArivuCanvasDocument;
    } catch {
      return null;
    }
  }
  const mode = String(fields.mode || 'crm') === 'presentation' ? 'presentation' : 'crm';
  const title = String(fields.title || 'Arivu Canvas').slice(0, 160);
  const outline = String(fields.outline || '').trim();
  if (!outline && mode === 'crm') return null;
  return {
    version: 2,
    mode,
    title,
    summary: outline.slice(0, 2000),
    heroSummary: outline.slice(0, 600),
    kpis: [],
    cards: [],
    slides: mode === 'presentation'
      ? outline.split(/\n/).filter(Boolean).slice(0, 12).map((line, idx) => ({
        id: `slide_${idx + 1}`,
        title: line.replace(/^\d+[\).]\s*/, '').replace(/^#+\s*/, '').slice(0, 120),
        bullets: [],
      }))
      : [],
    blocks: [],
    suggestedPrompts: [],
    conversationStarters: [],
    opportunities: [],
    actions: [],
    createdAt: new Date().toISOString(),
  };
}
