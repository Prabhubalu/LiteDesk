import { getApiUrlForFetch } from '@/config/apiBase';

export function resolveWebformImageUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return getApiUrlForFetch(raw);
  return raw;
}

export function slugifyWebformClient(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function buildWebformPublicUrl(slug, { embed = false, origin } = {}) {
  const base = (origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  const path = embed ? `/webforms/embed/${slug}` : `/webforms/public/${slug}`;
  return `${base}${path}`;
}

export function buildWebformIframeSnippet(slug, { height = 640, origin } = {}) {
  const url = buildWebformPublicUrl(slug, { embed: true, origin });
  return `<iframe src="${url}" title="Webform" width="100%" height="${height}" frameborder="0" style="border:0;border-radius:12px;max-width:720px;"></iframe>`;
}

export function buildWebformScriptSnippet(slug, { height = 640, origin } = {}) {
  const base = (origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return `<div id="litedesk-webform" data-slug="${slug}" data-height="${height}"></div>\n<script src="${base}/embed/webform.js" async></script>`;
}

export function buildCrmRecordPath(moduleKey, recordId) {
  const key = String(moduleKey || '').toLowerCase();
  const id = String(recordId || '');
  if (!id) return '';
  if (key === 'people') return `/people/${id}`;
  if (key === 'organizations') return `/organizations/${id}`;
  if (key === 'cases') return `/helpdesk/cases/${id}`;
  if (key === 'deals') return `/deals/${id}`;
  return '';
}

export const WEBFORM_RECORD_ACTIONS = ['create', 'update', 'create_or_update'];

export { WEBFORM_FIELD_TYPES } from '@/constants/moduleFieldTypes';

export function createWebformFieldId() {
  return `field_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
