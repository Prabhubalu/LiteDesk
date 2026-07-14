import { getApiUrlForFetch, getApiUrlForMedia } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';

function authHeaders() {
  const authStore = useAuthStore();
  const token = authStore.user?.token;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * Build a browser-openable download URL (new tab / img src) with JWT for optionalAuth.
 */
export function liveChatAttachmentHref(att) {
  if (!att) return '#';
  const url = String(att.url || '').trim();
  let path = '';
  if (url.startsWith('/api/') || url.startsWith('http://') || url.startsWith('https://')) {
    path = url;
  } else {
    const storagePath = String(att.storagePath || '').trim();
    if (storagePath.startsWith('oci:')) {
      const q = new URLSearchParams({
        storagePath,
        disposition: 'inline',
      });
      if (att.fileName) q.set('fileName', String(att.fileName));
      if (att.mimeType) q.set('contentType', String(att.mimeType));
      path = `/api/files/download?${q.toString()}`;
    } else if (storagePath) {
      path = `/api/uploads/${storagePath.replace(/^\//, '')}`;
    }
  }
  if (!path) return '#';

  let resolved = path;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const parsed = new URL(path);
      resolved = getApiUrlForMedia(`${parsed.pathname}${parsed.search}`);
    } catch {
      resolved = path;
    }
  } else {
    resolved = getApiUrlForMedia(path);
  }

  const token = useAuthStore().user?.token;
  if (!token || !String(resolved).includes('/files/download')) return resolved || '#';
  return `${resolved}${resolved.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

export async function uploadLiveChatMessageAttachment(sessionId, file) {
  const id = String(sessionId || '').trim();
  if (!id) {
    const err = new Error('sessionId is required');
    err.status = 400;
    throw err;
  }
  if (!file) {
    const err = new Error('file is required');
    err.status = 400;
    throw err;
  }

  const form = new FormData();
  form.append('file', file);

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), 60000)
    : null;

  let res;
  try {
    res = await fetch(getApiUrlForFetch(`/api/live-chat/sessions/${id}/message-attachments`), {
      method: 'POST',
      headers: authHeaders(),
      body: form,
      signal: controller?.signal,
    });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success) {
    const err = new Error(json?.message || 'Failed to upload attachment');
    err.status = res.status;
    throw err;
  }
  return json.data;
}
