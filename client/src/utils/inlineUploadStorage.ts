import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';

function authHeaders(): Record<string, string> {
  const authStore = useAuthStore();
  const token = authStore.user?.token;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Extract managed inline upload URLs from rich HTML (img src). */
export function extractInlineUploadImageUrls(html: string): string[] {
  const str = String(html || '');
  if (!str.includes('<img')) return [];

  if (typeof document === 'undefined') return [];

  const tpl = document.createElement('template');
  tpl.innerHTML = str;
  const urls = new Set<string>();
  tpl.content.querySelectorAll('img[src]').forEach((img) => {
    const src = (img.getAttribute('src') || '').trim();
    if (src && isManagedInlineUploadRef(src)) {
      urls.add(src);
    }
  });
  return [...urls];
}

export function isManagedInlineUploadRef(value: string): boolean {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (raw.startsWith('oci:uploads/')) return true;
  if (raw.startsWith('/api/files/download')) return raw.includes('storagePath=oci%3Auploads%2F') || raw.includes('storagePath=oci:uploads/');
  if (raw.startsWith('/api/uploads/')) return true;
  return false;
}

export async function deleteInlineUpload(urlOrStoragePath: string): Promise<void> {
  const ref = String(urlOrStoragePath || '').trim();
  if (!ref || !isManagedInlineUploadRef(ref)) return;

  const res = await fetch(getApiUrlForFetch('/api/upload'), {
    method: 'DELETE',
    headers: authHeaders(),
    body: JSON.stringify({ url: ref })
  });

  const result = await res.json().catch(() => ({}));
  if (!res.ok || !result.success) {
    throw new Error(result.message || 'Failed to delete upload');
  }
}

export async function deleteRemovedInlineUploads(beforeHtml: string, afterHtml: string): Promise<void> {
  const before = extractInlineUploadImageUrls(beforeHtml);
  const after = new Set(extractInlineUploadImageUrls(afterHtml));
  const removed = before.filter((url) => !after.has(url));
  await Promise.all(removed.map((url) => deleteInlineUpload(url).catch(() => undefined)));
}

export async function deleteOrphanSessionUploads(
  sessionUrls: string[],
  keptHtml: string
): Promise<void> {
  const kept = new Set(extractInlineUploadImageUrls(keptHtml));
  const orphans = sessionUrls.filter((url) => isManagedInlineUploadRef(url) && !kept.has(url));
  await Promise.all(orphans.map((url) => deleteInlineUpload(url).catch(() => undefined)));
}
