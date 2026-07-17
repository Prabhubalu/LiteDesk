import apiClient from '@/utils/apiClient';

export function listPlatformAnnouncementPresets() {
  return apiClient.get('/platform/announcements/presets');
}

export function listPlatformAnnouncements(query = {}) {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.category) params.set('category', query.category);
  if (query.includeSystem) params.set('includeSystem', 'true');
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  const qs = params.toString();
  return apiClient.get(`/platform/announcements${qs ? `?${qs}` : ''}`);
}

export function getPlatformAnnouncement(id) {
  return apiClient.get(`/platform/announcements/${id}`);
}

export function createPlatformAnnouncement(payload) {
  return apiClient.post('/platform/announcements', payload);
}

export function updatePlatformAnnouncement(id, payload) {
  return apiClient.put(`/platform/announcements/${id}`, payload);
}

export function publishPlatformAnnouncement(id) {
  return apiClient.post(`/platform/announcements/${id}/publish`, {});
}

export function pausePlatformAnnouncement(id) {
  return apiClient.post(`/platform/announcements/${id}/pause`, {});
}

export function archivePlatformAnnouncement(id) {
  return apiClient.delete(`/platform/announcements/${id}`);
}
