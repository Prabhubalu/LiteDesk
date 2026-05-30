const { resolveUserFromToken } = require('../utils/resolveUserFromToken');

/**
 * Attach req.user when a valid token is present; continue without auth otherwise.
 */
const optionalAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query?.token) {
    token = String(req.query.token).trim();
  }

  if (!token || !process.env.JWT_SECRET) {
    return next();
  }

  try {
    req.user = await resolveUserFromToken(token, { lean: false });
  } catch {
    // ignore invalid tokens for optional auth
  }
  return next();
};

module.exports = { optionalAuth };
