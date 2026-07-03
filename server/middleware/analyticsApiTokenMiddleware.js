const {
  resolveApiTokenFromRaw,
  loadActorUserForToken,
  touchTokenLastUsed,
} = require('../services/analytics/analyticsApiTokenService');

function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  const apiKey = req.headers['x-analytics-api-key'];
  if (apiKey) {
    return String(apiKey).trim();
  }
  return null;
}

/**
 * Authenticate analytics v1 requests via org API token.
 * Sets req.user (actor), req.analyticsApiToken, req.authMethod = 'analytics_api_token'.
 */
function protectAnalyticsApiToken() {
  return async (req, res, next) => {
    try {
      const raw = extractBearerToken(req);
      if (!raw) {
        return res.status(401).json({
          success: false,
          message: 'Analytics API token required',
          code: 'ANALYTICS_API_TOKEN_REQUIRED',
        });
      }

      const tokenDoc = await resolveApiTokenFromRaw(raw);
      if (!tokenDoc) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired analytics API token',
          code: 'ANALYTICS_API_TOKEN_INVALID',
        });
      }

      const user = await loadActorUserForToken(tokenDoc);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Token actor user not found',
          code: 'ANALYTICS_API_TOKEN_ACTOR_MISSING',
        });
      }

      if (String(user.status || 'active').toLowerCase() !== 'active') {
        return res.status(401).json({
          success: false,
          message: 'Token actor user is inactive',
          code: 'ANALYTICS_API_TOKEN_ACTOR_INACTIVE',
        });
      }

      try {
        const { hydrateUserPermissionsFromRole } = require('../utils/rolePermissionProjection');
        await hydrateUserPermissionsFromRole(user);
      } catch (_err) {
        /* optional */
      }

      req.user = user;
      req.analyticsApiToken = tokenDoc;
      req.authMethod = 'analytics_api_token';

      touchTokenLastUsed(tokenDoc._id).catch(() => {});

      return next();
    } catch (err) {
      console.error('Analytics API token auth error:', err);
      return res.status(500).json({ success: false, message: 'Server error during API token auth' });
    }
  };
}

module.exports = {
  protectAnalyticsApiToken,
  extractBearerToken,
};
