/**
 * @param {unknown} score
 * @returns {'success'|'warning'|'danger'|'default'}
 */
export function reputationScoreTone(score) {
  const num = Number(score);
  if (!Number.isFinite(num)) return 'default';
  if (num >= 80) return 'success';
  if (num >= 60) return 'warning';
  return 'danger';
}

/**
 * @param {unknown} score
 * @returns {string}
 */
export function reputationScoreClass(score) {
  const tone = reputationScoreTone(score);
  if (tone === 'success') return 'text-green-700 dark:text-green-300';
  if (tone === 'warning') return 'text-amber-700 dark:text-amber-300';
  if (tone === 'danger') return 'text-red-700 dark:text-red-300';
  return 'text-gray-900 dark:text-white';
}

/**
 * @param {unknown} score
 * @returns {string}
 */
export function reputationScoreBorderClass(score) {
  const tone = reputationScoreTone(score);
  if (tone === 'success') return 'border-green-200 dark:border-green-900/40';
  if (tone === 'warning') return 'border-amber-200 dark:border-amber-900/40';
  if (tone === 'danger') return 'border-red-200 dark:border-red-900/40';
  return 'border-gray-200 dark:border-gray-700';
}
