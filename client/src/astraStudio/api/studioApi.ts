import apiClient from '@/utils/apiClient';
import type {
  CanvasMeta,
  CanvasOp,
  CanvasWidget,
  StudioTemplateMeta,
} from '@/astraStudio/types';

const BASE = '/astra/studio';

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  message?: string;
}

function unwrap<T>(payload: ApiEnvelope<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiEnvelope<T>).data as T;
  }
  return payload as T;
}

export interface StudioStatus {
  enabled: boolean;
  templates: StudioTemplateMeta[];
}

export interface CanvasListResult {
  items: CanvasMeta[];
  total?: number;
}

export interface CanvasDetailResult {
  canvas: CanvasMeta;
  summary?: { widgetCount?: number; sectionCount?: number };
  hasYjsState?: boolean;
}

export interface CanvasRevision {
  _id: string;
  versionNumber: number;
  reason?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface CanvasSuggestion {
  _id: string;
  status?: string;
  kind?: string;
  title?: string;
  body?: string;
  message?: string;
  actionType?: string;
}

export interface CanvasComment {
  _id: string;
  body: string;
  createdAt?: string;
  authorId?: string;
  authorName?: string;
}

export async function getStatus(): Promise<StudioStatus> {
  const res = await apiClient.get(`${BASE}/status`);
  return unwrap<StudioStatus>(res);
}

export async function listCanvases(params?: {
  status?: string;
  limit?: number;
  skip?: number;
}): Promise<CanvasListResult> {
  const res = await apiClient.get(`${BASE}/canvases`, { params });
  return unwrap<CanvasListResult>(res);
}

export async function getCanvas(canvasId: string): Promise<CanvasDetailResult> {
  const res = await apiClient.get(`${BASE}/canvases/${encodeURIComponent(canvasId)}`);
  return unwrap<CanvasDetailResult>(res);
}

export async function createCanvas(body: {
  title?: string;
  canvasType?: string;
  focus?: Array<{ moduleKey: string; recordId: string }>;
  generate?: boolean;
  prompt?: string;
}): Promise<{ canvas: CanvasMeta }> {
  const res = await apiClient.post(`${BASE}/canvases`, body);
  return unwrap<{ canvas: CanvasMeta }>(res);
}

export async function hydrateCanvas(
  canvasId: string,
  body?: {
    prompt?: string;
    force?: boolean;
    focus?: Array<{ moduleKey: string; recordId: string }>;
  },
): Promise<{ canvas: CanvasMeta; hydrate?: { ok?: boolean; updated?: number } }> {
  const res = await apiClient.post(
    `${BASE}/canvases/${encodeURIComponent(canvasId)}/hydrate`,
    body || {},
  );
  return unwrap<{ canvas: CanvasMeta; hydrate?: { ok?: boolean; updated?: number } }>(res);
}

export async function updateCanvas(
  canvasId: string,
  body: Partial<{
    title: string;
    status: string;
    layoutMeta: Record<string, number | boolean | undefined>;
  }>,
): Promise<{ canvas: CanvasMeta }> {
  const res = await apiClient.patch(`${BASE}/canvases/${encodeURIComponent(canvasId)}`, body);
  return unwrap<{ canvas: CanvasMeta }>(res);
}

export async function deleteCanvas(canvasId: string): Promise<void> {
  await apiClient.delete(`${BASE}/canvases/${encodeURIComponent(canvasId)}`);
}

export async function applyOps(canvasId: string, ops: CanvasOp[]): Promise<{ widgets?: CanvasWidget[] }> {
  const res = await apiClient.post(`${BASE}/canvases/${encodeURIComponent(canvasId)}/ops`, { ops });
  return unwrap<{ widgets?: CanvasWidget[] }>(res);
}

export async function listRevisions(canvasId: string): Promise<{ items: CanvasRevision[] }> {
  const res = await apiClient.get(`${BASE}/canvases/${encodeURIComponent(canvasId)}/revisions`);
  return unwrap<{ items: CanvasRevision[] }>(res);
}

export async function createRevision(canvasId: string, reason?: string): Promise<{ revision: CanvasRevision }> {
  const res = await apiClient.post(`${BASE}/canvases/${encodeURIComponent(canvasId)}/revisions`, {
    reason: reason || 'manual',
  });
  return unwrap<{ revision: CanvasRevision }>(res);
}

export async function restoreRevision(canvasId: string, versionNumber: number): Promise<void> {
  await apiClient.post(
    `${BASE}/canvases/${encodeURIComponent(canvasId)}/revisions/${versionNumber}/restore`,
    {},
  );
}

export async function listSuggestions(canvasId: string): Promise<{ items: CanvasSuggestion[] }> {
  const res = await apiClient.get(`${BASE}/canvases/${encodeURIComponent(canvasId)}/suggestions`);
  return unwrap<{ items: CanvasSuggestion[] }>(res);
}

export async function resolveSuggestion(
  canvasId: string,
  suggestionId: string,
  action: 'accept' | 'dismiss' = 'accept',
): Promise<void> {
  await apiClient.post(
    `${BASE}/canvases/${encodeURIComponent(canvasId)}/suggestions/${encodeURIComponent(suggestionId)}/resolve`,
    { status: action === 'accept' ? 'accepted' : 'dismissed' },
  );
}

export async function listComments(canvasId: string): Promise<{ items: CanvasComment[] }> {
  const res = await apiClient.get(`${BASE}/canvases/${encodeURIComponent(canvasId)}/comments`);
  return unwrap<{ items: CanvasComment[] }>(res);
}

export async function createComment(canvasId: string, body: string): Promise<{ comment: CanvasComment }> {
  const res = await apiClient.post(`${BASE}/canvases/${encodeURIComponent(canvasId)}/comments`, { body });
  return unwrap<{ comment: CanvasComment }>(res);
}

export async function exportCanvas(
  canvasId: string,
  format: 'pdf' | 'html' | 'docx' | 'pptx' | 'xlsx' = 'html',
): Promise<Record<string, unknown>> {
  const res = await apiClient.post(`${BASE}/canvases/${encodeURIComponent(canvasId)}/export`, { format });
  return unwrap<Record<string, unknown>>(res);
}
