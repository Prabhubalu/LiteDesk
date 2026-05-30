import { useAuthStore } from '@/stores/authRegistry';
import { getApiUrlForFetch } from '@/config/apiBase';

async function parseJsonResponse(response) {
  if (response.status === 401) {
    const authStore = useAuthStore();
    authStore.logout();
    throw new Error('Session expired. Please log in again.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `HTTP error! Status: ${response.status}`);
    error.status = response.status;
    error.response = { data };
    throw error;
  }
  return data;
}

/** Stage via multipart upload instead of inline JSON (keeps under server 10mb JSON limit). */
export const STAGING_THRESHOLD_BYTES = 5 * 1024 * 1024;

/** Must match server IMPORT_INLINE_MAX_ROWS (default 5000). */
export const IMPORT_INLINE_MAX_ROWS = Number(import.meta.env.VITE_IMPORT_INLINE_MAX_ROWS || 5000);

export function shouldStageCsvUpload(fileSizeBytes, rowCount = null) {
  if (Number(fileSizeBytes || 0) > STAGING_THRESHOLD_BYTES) return true;
  if (rowCount != null && Number(rowCount) > IMPORT_INLINE_MAX_ROWS) return true;
  return false;
}

export async function stageCsvForImport(file) {
  const authStore = useAuthStore();
  const token = authStore.user?.token;
  const formData = new FormData();
  formData.append('file', file);

  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(getApiUrlForFetch('/csv/staging'), {
    method: 'POST',
    headers,
    body: formData,
  });

  const payload = await parseJsonResponse(response);
  if (!payload.success) {
    throw new Error(payload.message || 'Failed to stage CSV upload');
  }
  return payload.data;
}

export async function uploadCsvImport(endpoint, file, config) {
  const authStore = useAuthStore();
  const token = authStore.user?.token;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('config', JSON.stringify(config));

  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(getApiUrlForFetch(endpoint), {
    method: 'POST',
    headers,
    body: formData,
  });

  return parseJsonResponse(response);
}
