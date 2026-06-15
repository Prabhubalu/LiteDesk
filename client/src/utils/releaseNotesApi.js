import apiClient from '@/utils/apiClient';

export function getUnseen() {
  return apiClient.get('/release-notes/unseen');
}

export function getBadge() {
  return apiClient.get('/release-notes/badge');
}

export function getHistory({ page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit)
  });
  return apiClient.get(`/release-notes/history?${params.toString()}`);
}

export function markViewed(releaseNoteId, source) {
  return apiClient.post(`/release-notes/${releaseNoteId}/view`, { source });
}

export function markViewedBatch(releaseNoteIds, source) {
  return apiClient.post('/release-notes/view-batch', { releaseNoteIds, source });
}

export function snooze(hours = 24) {
  return apiClient.post('/release-notes/snooze', { hours });
}

export function listPlatformNotes({ status, page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  return apiClient.get(`/platform/release-notes?${params.toString()}`);
}

export function getPlatformNote(id) {
  return apiClient.get(`/platform/release-notes/${id}`);
}

export function createPlatformNote(payload) {
  return apiClient.post('/platform/release-notes', payload);
}

export function updatePlatformNote(id, payload) {
  return apiClient.put(`/platform/release-notes/${id}`, payload);
}

export function archivePlatformNote(id) {
  return apiClient.delete(`/platform/release-notes/${id}`);
}

export function publishPlatformNote(id) {
  return apiClient.post(`/platform/release-notes/${id}/publish`, {});
}

export function schedulePlatformNote(id, scheduledPublishAt) {
  return apiClient.post(`/platform/release-notes/${id}/schedule`, { scheduledPublishAt });
}

export function getPlatformAudiencePreview(id) {
  return apiClient.get(`/platform/release-notes/${id}/audience-preview`);
}

export function getPlatformStats(id) {
  return apiClient.get(`/platform/release-notes/${id}/stats`);
}
