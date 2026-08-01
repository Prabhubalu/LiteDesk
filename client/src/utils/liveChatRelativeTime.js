import { formatUserDate, formatUserDateTime } from '@/utils/localeFormat';
/**
 * Compact relative time for queue rows (e.g. "2m", "1h", "3d").
 */
export function formatLiveChatRelativeTime(value, now = Date.now()) {
  if (!value) return '';
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return '';

  const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
  if (diffSec < 60) return `${Math.max(diffSec, 1)}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d`;
  try {
    return formatUserDate(value);
  } catch {
    return '';
  }
}

/**
 * Elapsed duration from session start (HH:MM:SS).
 */
export function formatLiveChatElapsed(value, now = Date.now()) {
  if (!value) return '00:00:00';
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return '00:00:00';

  const totalSec = Math.max(0, Math.floor((now - ts) / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Human-readable duration between two timestamps (e.g. "4m", "1h 12m").
 */
export function formatLiveChatDurationBetween(startValue, endValue) {
  if (!startValue || !endValue) return '—';
  const start = new Date(startValue).getTime();
  const end = new Date(endValue).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '—';

  const totalSec = Math.floor((end - start) / 1000);
  if (totalSec < 60) return `${Math.max(totalSec, 1)}s`;
  const minutes = Math.floor(totalSec / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (hours < 24) return remMin ? `${hours}h ${remMin}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHour = hours % 24;
  return remHour ? `${days}d ${remHour}h` : `${days}d`;
}

export function formatLiveChatDateTime(value) {
  if (!value) return '—';
  try {
    return formatUserDateTime(value);
  } catch {
    return '—';
  }
}
