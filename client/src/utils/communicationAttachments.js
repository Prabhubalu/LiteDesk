import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';

function authHeaders() {
  const authStore = useAuthStore();
  const token = authStore.user?.token;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function isOciCommunicationStoragePath(storagePath) {
  return String(storagePath || '').startsWith('oci:');
}

export function buildCommunicationAttachmentDownloadPath(
  storagePath,
  { disposition = 'attachment', fileName, contentType } = {}
) {
  const disp = disposition === 'inline' ? 'inline' : 'attachment';
  const q = new URLSearchParams({
    storagePath: String(storagePath),
    disposition: disp
  });
  if (fileName) q.set('fileName', String(fileName));
  if (contentType) q.set('contentType', String(contentType));
  return `/api/communications/attachments/download?${q.toString()}`;
}

export async function fetchCommunicationAttachmentBlob(
  storagePath,
  { disposition = 'attachment', fileName, contentType } = {}
) {
  const path = buildCommunicationAttachmentDownloadPath(storagePath, {
    disposition,
    fileName,
    contentType
  });
  const res = await fetch(getApiUrlForFetch(path), { headers: authHeaders() });
  if (!res.ok) {
    const err = new Error('Failed to load attachment');
    err.status = res.status;
    throw err;
  }
  const blob = await res.blob();
  const resolvedContentType =
    res.headers.get('content-type') || blob.type || contentType || 'application/octet-stream';
  return { blob, contentType: resolvedContentType };
}

export async function uploadCommunicationAttachment(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(getApiUrlForFetch('/api/communications/upload-oci'), {
    method: 'POST',
    headers: authHeaders(),
    body: formData
  });
  const result = await res.json();
  if (!res.ok || !result.success) {
    const err = new Error(result.message || result.error || 'Upload failed');
    err.status = res.status;
    throw err;
  }
  return result;
}

export async function downloadCommunicationAttachment(att, { disposition = 'attachment' } = {}) {
  const storagePath = att?.storagePath;
  if (!storagePath) return;
  if (isOciCommunicationStoragePath(storagePath)) {
    const { blob } = await fetchCommunicationAttachmentBlob(storagePath, { disposition });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = String(att.fileName || att.name || 'attachment');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }
  const href = getApiUrlForFetch(`/api/uploads/${storagePath}`);
  const a = document.createElement('a');
  a.href = href;
  a.download = String(att.fileName || att.name || 'attachment');
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Direct href for legacy disk uploads; OCI requires authenticated fetch. */
export function getCommunicationAttachmentHref(att) {
  const storagePath = att?.storagePath;
  if (!storagePath || isOciCommunicationStoragePath(storagePath)) return null;
  return getApiUrlForFetch(`/api/uploads/${storagePath}`);
}
