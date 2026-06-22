import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';

function authHeaders() {
  const authStore = useAuthStore();
  const token = authStore.user?.token;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
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
