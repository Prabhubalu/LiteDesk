/**
 * Locale-aware relative timestamps (common.* ICU messages).
 * @param {string|Date} date
 * @param {(key: string, params?: Record<string, unknown>) => string} t
 */
export function formatRelativeTime(date, t) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const seconds = Math.floor((now - d) / 1000);
  if (seconds < 60) return t('common.relativeJustNow');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return minutes === 1
      ? t('common.relativeOneMinuteAgo')
      : t('common.relativeManyMinutesAgo', { count: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1
      ? t('common.relativeOneHourAgo')
      : t('common.relativeManyHoursAgo', { count: hours });
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return days === 1
      ? t('common.relativeOneDayAgo')
      : t('common.relativeManyDaysAgo', { count: days });
  }
  const months = Math.floor(days / 30);
  if (months < 12) {
    return months === 1
      ? t('common.relativeOneMonthAgo')
      : t('common.relativeManyMonthsAgo', { count: months });
  }
  const years = Math.floor(months / 12);
  return years === 1
    ? t('common.relativeOneYearAgo')
    : t('common.relativeManyYearsAgo', { count: years });
}
