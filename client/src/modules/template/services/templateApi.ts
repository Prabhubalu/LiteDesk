import apiClient from '@/utils/apiClient';
import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';
import type { GrapesTemplateDefinition } from '../editor/storage';

export interface TemplateRecord {
  _id: string;
  name: string;
  description?: string;
  status?: string;
  moduleScope?: string;
  outputFormat?: string;
  paperSize?: string;
  orientation?: string;
  customPageWidth?: number | null;
  customPageHeight?: number | null;
  margins?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  currencyDisplay?: 'code' | 'symbol';
  draftDefinition?: GrapesTemplateDefinition | Record<string, unknown> | null;
}

export interface TemplateMetadataPatch {
  name?: string;
  description?: string;
  moduleScope?: string;
  paperSize?: string;
  orientation?: string;
  customPageWidth?: number | null;
  customPageHeight?: number | null;
  margins?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  currencyDisplay?: 'code' | 'symbol';
}

export async function fetchTemplate(id: string): Promise<TemplateRecord> {
  const response = await apiClient.get(`/templates/${id}`, { cache: 'no-store' });
  if (!response?.success) {
    throw new Error(response?.message || 'Failed to load template');
  }
  return response.data as TemplateRecord;
}

export async function updateTemplateDefinition(
  id: string,
  payload: {
    jsonDefinition?: GrapesTemplateDefinition;
  } & TemplateMetadataPatch
): Promise<TemplateRecord> {
  const response = await apiClient.put(`/templates/${id}`, payload);
  if (!response?.success) {
    throw new Error(response?.message || 'Failed to save template');
  }
  return response.data as TemplateRecord;
}

export async function publishTemplate(id: string, releaseNotes = ''): Promise<TemplateRecord> {
  const response = await apiClient.post(`/templates/${id}/publish`, { releaseNotes });
  if (!response?.success) {
    throw new Error(response?.message || 'Failed to publish template');
  }
  return response.data as TemplateRecord;
}

function previewAuthHeaders(): Record<string, string> {
  const authStore = useAuthStore();
  const headers: Record<string, string> = {};
  if (authStore.user?.token) {
    headers.Authorization = `Bearer ${authStore.user.token}`;
  }
  return headers;
}

async function fetchRenderedOutputBlob(renderResult: {
  previewUrl?: string;
  downloadUrl?: string;
}): Promise<{ blob: Blob; contentType: string }> {
  const path = renderResult?.previewUrl;
  if (!path) {
    throw new Error('Preview URL missing');
  }

  const response = await fetch(getApiUrlForFetch(path), { headers: previewAuthHeaders() });
  if (!response.ok) {
    throw new Error('Failed to load rendered output');
  }

  const blob = await response.blob();
  const contentType = response.headers.get('content-type') || blob.type || 'application/pdf';
  return { blob, contentType };
}

function pdfBlobFromRenderResult(renderResult: Record<string, unknown>): Blob | null {
  const mimeType = String(renderResult.mimeType || 'application/pdf');
  const buffer = renderResult.buffer as { type?: string; data?: number[] } | undefined;
  if (buffer?.type === 'Buffer' && Array.isArray(buffer.data)) {
    return new Blob([new Uint8Array(buffer.data)], { type: mimeType });
  }
  return null;
}

function openPreviewBlob(blob: Blob, contentType: string): void {
  const blobUrl = URL.createObjectURL(new Blob([blob], { type: contentType }));
  // noopener makes window.open return null even when the tab opens — do not fall back to <a click>.
  window.open(blobUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
}

async function resolvePreviewBlob(
  renderResult: Record<string, unknown>
): Promise<Blob> {
  const inlineBlob = pdfBlobFromRenderResult(renderResult);
  const mimeType = String(renderResult.mimeType || 'application/pdf');

  if (inlineBlob) {
    return inlineBlob;
  }

  const { blob, contentType } = await fetchRenderedOutputBlob(
    renderResult as { previewUrl?: string }
  );
  return new Blob([blob], { type: contentType || mimeType });
}

export async function fetchTemplatePreviewBlob(
  id: string,
  options: {
    recordModuleKey?: string;
    recordId?: string;
    jsonDefinition?: GrapesTemplateDefinition;
    pageSettings?: TemplateMetadataPatch;
  } = {}
): Promise<Blob> {
  const renderResult = await renderTemplatePdf(id, options);
  return resolvePreviewBlob(renderResult);
}

export async function renderTemplatePdf(
  id: string,
  options: {
    recordModuleKey?: string;
    recordId?: string;
    jsonDefinition?: GrapesTemplateDefinition;
    pageSettings?: TemplateMetadataPatch;
  } = {}
): Promise<Record<string, unknown>> {
  const runtimeContext: Record<string, string> = {};
  if (options.recordId) runtimeContext.recordId = options.recordId;
  if (options.recordModuleKey) runtimeContext.recordModuleKey = options.recordModuleKey;

  const response = await apiClient.post(`/templates/${id}/render`, {
    outputFormat: 'pdf',
    preview: true,
    persistOutput: false,
    jsonDefinition: options.jsonDefinition,
    pageSettings: options.pageSettings,
    runtimeContext
  });

  if (!response?.success) {
    throw new Error(response?.message || 'Failed to render template');
  }

  return response.data as Record<string, unknown>;
}

export async function previewTemplatePdf(
  id: string,
  options: {
    recordModuleKey?: string;
    recordId?: string;
    jsonDefinition?: GrapesTemplateDefinition;
    pageSettings?: TemplateMetadataPatch;
  } = {}
): Promise<Record<string, unknown>> {
  const renderResult = await renderTemplatePdf(id, options);
  const blob = await resolvePreviewBlob(renderResult);
  const mimeType = String(renderResult.mimeType || blob.type || 'application/pdf');
  openPreviewBlob(blob, mimeType);
  return renderResult;
}
