const ANALYTICS_API_TOKEN_PREFIX = 'ld_analytics_';
const ANALYTICS_API_TOKEN_STATUSES = Object.freeze(['active', 'revoked']);

const ANALYTICS_API_TOKEN_SCOPES = Object.freeze([
  'reports:read',
  'reports:execute',
  'reports:export',
  'widgets:read',
  'widgets:execute',
  'dashboards:read',
  'dashboards:execute',
]);

const DEFAULT_ANALYTICS_API_TOKEN_SCOPES = Object.freeze([
  'reports:read',
  'reports:execute',
]);

module.exports = {
  ANALYTICS_API_TOKEN_PREFIX,
  ANALYTICS_API_TOKEN_STATUSES,
  ANALYTICS_API_TOKEN_SCOPES,
  DEFAULT_ANALYTICS_API_TOKEN_SCOPES,
};
