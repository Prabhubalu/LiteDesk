import { getApiUrlForFetch } from '@/config/apiBase';

/** Resolve uploaded or relative release-note image URLs for display. */
export function resolveReleaseNoteImageUrl(url: string | null | undefined): string {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return getApiUrlForFetch(raw);
  return raw;
}
