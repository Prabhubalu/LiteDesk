import { getPortalApiUrl } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';

export async function uploadPortalAttachment(file) {
  const authStore = useAuthStore();
  const token = authStore.user?.token;
  if (!token) {
    const err = new Error('Authentication required');
    err.status = 401;
    throw err;
  }
  if (!file) {
    const err = new Error('file is required');
    err.status = 400;
    throw err;
  }

  const form = new FormData();
  form.append('file', file);

  const res = await fetch(getPortalApiUrl('/portal/mailroom/attachments'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!res.ok) {
    const err = new Error('Failed to upload attachment');
    err.status = res.status;
    throw err;
  }

  const json = await res.json();
  if (!json?.success) {
    const err = new Error(json?.message || 'Failed to upload attachment');
    err.status = 400;
    throw err;
  }
  return json.data;
}

