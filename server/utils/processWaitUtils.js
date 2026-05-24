/**
 * Wait / delay helpers for process engine.
 */

const UNIT_MS = {
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000
};

/**
 * @param {number} duration
 * @param {'minutes'|'hours'|'days'} unit
 * @returns {number} milliseconds
 */
function computeDelayMs(duration, unit) {
  const n = Math.max(1, Number(duration) || 1);
  const mult = UNIT_MS[unit] || UNIT_MS.hours;
  return n * mult;
}

/**
 * @param {number} duration
 * @param {'minutes'|'hours'|'days'} unit
 * @returns {Date}
 */
function computeResumeAt(duration, unit, fromDate = new Date()) {
  return new Date(fromDate.getTime() + computeDelayMs(duration, unit));
}

function formatWaitLabel(duration, unit) {
  const n = Number(duration) || 1;
  const u = unit === 'minutes' ? 'minute' : unit === 'hours' ? 'hour' : 'day';
  const plural = n === 1 ? u : `${u}s`;
  return `Wait ${n} ${plural}`;
}

module.exports = {
  computeDelayMs,
  computeResumeAt,
  formatWaitLabel,
  UNIT_MS
};
