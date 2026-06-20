export const PRESENCE_HEARTBEAT_MS = 20_000;
export const PRESENCE_POLL_MS = 5_000;
export const PRESENCE_STALE_MS = PRESENCE_HEARTBEAT_MS + PRESENCE_POLL_MS + 10_000;

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
