import apiClient from '@/utils/apiClient';
import type { GrapesTemplateDefinition } from '../editor/storage';

export interface DetectedMergeTag {
  raw: string;
  pattern: string;
  platform: string;
  index: number;
}

export interface HtmlAnalysisChecks {
  htmlValid: boolean;
  inlineCssFound: boolean;
  imagesDetected: boolean;
  tablesDetected: boolean;
  linksFound: boolean;
  mergeTagsFound: boolean;
  hubspotConditionalsFound?: boolean;
}

export interface HubspotConditionalBlock {
  raw: string;
  kind: string;
  index: number;
}

export interface HtmlAnalysisWarning {
  type: string;
  detail: string;
  line?: number;
  property?: string;
}

export interface HtmlAnalysisResult {
  checks: HtmlAnalysisChecks;
  counts: {
    images: number;
    tables: number;
    links: number;
    mergeTags: number;
    hubspotConditionals?: number;
  };
  mergeTags: DetectedMergeTag[];
  hubspotConditionals?: HubspotConditionalBlock[];
  warnings: HtmlAnalysisWarning[];
  sanitizedHtml: string;
  css: string;
  suggestedName: string;
  jsonDefinition: GrapesTemplateDefinition;
  orgMergeMappings?: Record<string, MergeMapping>;
  externalCssAllowlist?: string[];
}

export interface HtmlAnalysisOptions {
  hubspotConditionalMode?: 'keep' | 'strip';
  fetchExternalCss?: boolean;
}

export interface ClientPreviewStatus {
  enabled: boolean;
  clients: Array<{ code: string; label: string }>;
}

export interface ClientPreviewSession {
  emailGuid: string;
  clients: Array<{ code: string; label: string; previewPath: string }>;
}

export interface MergeMapping {
  path?: string;
  skip?: boolean;
}

export type MergeMappingRecord = Record<string, MergeMapping>;

export async function fetchOrgMergeMappings(): Promise<MergeMappingRecord> {
  const response = await apiClient.get('/templates/html/merge-mappings', { cache: 'no-store' });
  if (!response?.success) {
    throw new Error(response?.message || 'Failed to load merge mappings');
  }
  return (response.data?.mappings || {}) as MergeMappingRecord;
}

export async function saveOrgMergeMappings(
  mappings: MergeMappingRecord,
  options: { replace?: boolean } = {}
): Promise<MergeMappingRecord> {
  const response = await apiClient.put('/templates/html/merge-mappings', {
    mappings,
    replace: options.replace === true
  });
  if (!response?.success) {
    throw new Error(response?.message || 'Failed to save merge mappings');
  }
  return (response.data?.mappings || {}) as MergeMappingRecord;
}

export async function analyzeTemplateHtml(
  html: string,
  mergeMappings: Record<string, MergeMapping> = {},
  options: HtmlAnalysisOptions = {}
): Promise<HtmlAnalysisResult> {
  const response = await apiClient.post('/templates/html/analyze', {
    html,
    mergeMappings,
    hubspotConditionalMode: options.hubspotConditionalMode || 'keep',
    fetchExternalCss: options.fetchExternalCss !== false
  });
  if (!response?.success) {
    throw new Error(response?.message || 'Failed to analyze HTML');
  }
  return response.data as HtmlAnalysisResult;
}

export async function fetchCssAllowlist(): Promise<string[]> {
  const response = await apiClient.get('/templates/html/css-allowlist', { cache: 'no-store' });
  if (!response?.success) {
    throw new Error(response?.message || 'Failed to load CSS allowlist');
  }
  return (response.data?.allowlist || []) as string[];
}

export async function saveCssAllowlist(allowlist: string[]): Promise<string[]> {
  const response = await apiClient.put('/templates/html/css-allowlist', { allowlist });
  if (!response?.success) {
    throw new Error(response?.message || 'Failed to save CSS allowlist');
  }
  return (response.data?.allowlist || []) as string[];
}

export async function fetchClientPreviewStatus(): Promise<ClientPreviewStatus> {
  const response = await apiClient.get('/templates/html/client-preview/status', { cache: 'no-store' });
  if (!response?.success) {
    throw new Error(response?.message || 'Failed to load client preview status');
  }
  return response.data as ClientPreviewStatus;
}

export async function createClientPreview(
  html: string,
  subject = ''
): Promise<ClientPreviewSession> {
  const response = await apiClient.post('/templates/html/client-preview', { html, subject });
  if (!response?.success) {
    throw new Error(response?.message || 'Failed to create client preview');
  }
  return response.data as ClientPreviewSession;
}
