import { getApiUrlForFetch } from '@/config/apiBase';

/**
 * Upload a file for a public webform field.
 * @param {{ slug: string, fieldId: string, file: File }} params
 */
export async function uploadPublicWebformFile({ slug, fieldId, file }) {
  const formData = new FormData();
  formData.append('file', file);
  if (fieldId) formData.append('fieldId', fieldId);

  const response = await fetch(getApiUrlForFetch(`/api/public/webforms/${encodeURIComponent(slug)}/upload`), {
    method: 'POST',
    body: formData
  });

  const result = await response.json();
  if (!response.ok || !result.success || !result.data?.uploadToken) {
    throw new Error(result.message || 'Upload failed');
  }

  return result.data;
}
