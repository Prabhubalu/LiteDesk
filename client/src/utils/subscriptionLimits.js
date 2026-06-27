/** @param {unknown} limit */
export function isFiniteSubscriptionLimit(limit) {
  return typeof limit === 'number' && Number.isFinite(limit) && limit >= 0;
}

/** @param {unknown} limit @param {(key: string) => string} t */
export function formatSubscriptionLimitLabel(limit, t) {
  if (!isFiniteSubscriptionLimit(limit)) {
    return t('settings.addonsUnlimited');
  }
  return String(limit);
}

/** @param {unknown} current @param {unknown} limit */
export function getUsagePercentage(current, limit) {
  if (!isFiniteSubscriptionLimit(limit) || limit === 0) return 0;
  return Math.min(100, Math.round(((Number(current) || 0) / limit) * 100));
}

/** @param {unknown} current @param {unknown} limit */
export function usageBarWidthPercent(current, limit) {
  return `${getUsagePercentage(current, limit)}%`;
}
