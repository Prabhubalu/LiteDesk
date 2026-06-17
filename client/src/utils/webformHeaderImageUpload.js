import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';

/**
 * Upload a webform header image via the standard /api/upload endpoint.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function uploadWebformHeaderImage(file) {
  const formData = new FormData();
  formData.append('file', file);

  const authStore = useAuthStore();
  const token = authStore.user?.token;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(getApiUrlForFetch('/api/upload'), {
    method: 'POST',
    headers,
    body: formData
  });

  const result = await response.json();
  if (!response.ok || !result.success || !result.url) {
    throw new Error(result.message || 'Upload failed');
  }
  return String(result.url);
}
