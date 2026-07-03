const User = require('../models/User');
const {
  resolveEmbedTokenFromRaw,
  touchEmbedTokenLastUsed,
} = require('../services/analytics/analyticsEmbedTokenService');

function extractEmbedToken(req) {
  if (req.query?.token) return String(req.query.token).trim();
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  if (req.body?.token) return String(req.body.token).trim();
  return null;
}

function protectAnalyticsEmbedToken() {
  return async (req, res, next) => {
    try {
      const raw = extractEmbedToken(req);
      if (!raw) {
        return res.status(401).json({
          success: false,
          message: 'Embed token required',
          code: 'ANALYTICS_EMBED_TOKEN_REQUIRED',
        });
      }

      const tokenDoc = await resolveEmbedTokenFromRaw(raw);
      if (!tokenDoc) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired embed token',
          code: 'ANALYTICS_EMBED_TOKEN_INVALID',
        });
      }

      const user = await User.findById(tokenDoc.createdBy).select('-password');
      if (!user || String(user.organizationId) !== String(tokenDoc.organizationId)) {
        return res.status(401).json({
          success: false,
          message: 'Embed token actor not found',
          code: 'ANALYTICS_EMBED_TOKEN_ACTOR_MISSING',
        });
      }

      try {
        const { hydrateUserPermissionsFromRole } = require('../utils/rolePermissionProjection');
        await hydrateUserPermissionsFromRole(user);
      } catch (_err) {
        /* optional */
      }

      req.user = user;
      req.analyticsEmbedToken = tokenDoc;
      req.authMethod = 'analytics_embed_token';

      touchEmbedTokenLastUsed(tokenDoc._id).catch(() => {});

      return next();
    } catch (err) {
      console.error('Analytics embed token auth error:', err);
      return res.status(500).json({ success: false, message: 'Server error during embed auth' });
    }
  };
}

module.exports = {
  protectAnalyticsEmbedToken,
  extractEmbedToken,
};
