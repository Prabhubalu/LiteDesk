import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';

/**
 * Unwrap LiteDesk API JSON from apiClient (returns body directly, not axios-style).
 */
export function unwrapCatalogApiData(res) {
  if (!res || res.success === false) return null;
  if (res.data !== undefined) return res.data;
  return res;
}

export function unwrapCatalogApiList(res) {
  const data = unwrapCatalogApiData(res);
  return Array.isArray(data) ? data : [];
}

/** POST multipart/form-data (e.g. item media upload). */
export async function catalogPostForm(url, formData) {
  const authStore = useAuthStore();
  const token = authStore.user?.token;
  const fullUrl = getApiUrlForFetch(url);
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData
  });
  const data = await response.json();
  if (!response.ok || data.success === false) {
    const err = new Error(data.message || `Upload failed (${response.status})`);
    err.status = response.status;
    throw err;
  }
  return data;
}
