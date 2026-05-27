import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';

function authHeaders() {
  const authStore = useAuthStore();
  const token = authStore.user?.token;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function buildMailroomAttachmentDownloadPath(attachmentId, { disposition = 'attachment' } = {}) {
  const disp = disposition === 'inline' ? 'inline' : 'attachment';
  return `/api/mailroom/attachments/${encodeURIComponent(attachmentId)}/download?disposition=${disp}`;
}

export async function fetchMailroomAttachmentBlob(attachmentId, { disposition = 'attachment' } = {}) {
  const path = buildMailroomAttachmentDownloadPath(attachmentId, { disposition });
  const res = await fetch(getApiUrlForFetch(path), { headers: authHeaders() });
  if (!res.ok) {
    const err = new Error('Failed to load attachment');
    err.status = res.status;
    throw err;
  }
  const blob = await res.blob();
  const contentType = res.headers.get('content-type') || blob.type || 'application/octet-stream';
  return { blob, contentType };
}

export async function downloadMailroomAttachment(attachment, { disposition = 'attachment' } = {}) {
  const id = attachment?.id || attachment?._id;
  if (!id) return;
  const { blob } = await fetchMailroomAttachmentBlob(id, { disposition });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = String(attachment.originalFileName || 'attachment');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function isMailroomImageMime(mimeType) {
  return /^image\//i.test(String(mimeType || ''));
}

export function isMailroomPreviewableMime(mimeType) {
  const m = String(mimeType || '').toLowerCase();
  return m.startsWith('image/') || m === 'application/pdf';
}

export function formatMailroomAttachmentSize(bytes) {
  const n = Number(bytes || 0);
  if (n <= 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
