const NATIVE_DOCUMENT_TYPES = new Set([
  'rich_document',
  'sop',
  'knowledge_article',
  'meeting_notes',
  'playbook',
  'checklist',
  'template',
  'generated_document'
]);

const EDITABLE_FILE_TYPES = new Set(['DOCX', 'DOC', 'XLSX', 'XLS', 'PPTX', 'PPT']);

export const PRESENCE_HEARTBEAT_MS = 20_000;
export const PRESENCE_POLL_MS = 5_000;
export const PRESENCE_TTL_MS = 60_000;
/** Hide avatars if lastSeenAt is older than this (covers missed leave + keep-alive). */
export const PRESENCE_STALE_MS = PRESENCE_HEARTBEAT_MS + PRESENCE_POLL_MS + 10_000;

export function isNativeDocument(record) {
  if (!record) return false;
  const type = String(record.documentType || '').toLowerCase();
  if (type === 'external_link') return false;
  if (type === 'file') return false;
  return NATIVE_DOCUMENT_TYPES.has(type) || type === 'rich_document';
}

export function isEditableUploadedFile(record) {
  if (!record) return false;
  if (String(record.documentType || '') !== 'file') return false;
  const fileType = String(record.fileType || '').toUpperCase();
  return EDITABLE_FILE_TYPES.has(fileType);
}

export function supportsReservation(record) {
  return isEditableUploadedFile(record);
}

export function resolveReservationState(record, now = new Date()) {
  const state = record?.coordinationState || record?.reservationStatus;
  if (state === 'available' || state === 'reserved' || state === 'expired') {
    if (state === 'reserved' && record?.reservationExpiresAt) {
      const expiresAt = new Date(record.reservationExpiresAt);
      if (expiresAt.getTime() < now.getTime()) return 'expired';
    }
    return state;
  }
  if (!record?.reservedBy) return 'available';
  const expiresAt = record.reservationExpiresAt ? new Date(record.reservationExpiresAt) : null;
  if (expiresAt && expiresAt.getTime() < now.getTime()) return 'expired';
  return 'reserved';
}

export function resolveReservedUserId(record) {
  const value = record?.reservedBy;
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || '');
  return String(value);
}

export function formatUserName(user) {
  if (!user || typeof user !== 'object') return '';
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || '';
}

export function formatRelativeMinutes(date, now = new Date()) {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  const diffMs = now.getTime() - parsed.getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60_000));
  if (minutes < 60) return String(minutes);
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

export function formatReservationRemaining(expiresAt, now = new Date()) {
  if (!expiresAt) return '';
  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) return '';
  const diffMs = parsed.getTime() - now.getTime();
  if (diffMs <= 0) return '';
  const totalMinutes = Math.ceil(diffMs / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function getCoordinationSectionKey(record) {
  if (supportsReservation(record)) return 'reservation';
  return null;
}
