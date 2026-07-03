const ANALYTICS_ALERT_STATUSES = Object.freeze(['active', 'paused']);
const ANALYTICS_ALERT_OPERATORS = Object.freeze(['lt', 'lte', 'gt', 'gte', 'eq']);
const ANALYTICS_ALERT_COOLDOWN_MS = 60 * 60 * 1000;

module.exports = {
  ANALYTICS_ALERT_STATUSES,
  ANALYTICS_ALERT_OPERATORS,
  ANALYTICS_ALERT_COOLDOWN_MS,
};
