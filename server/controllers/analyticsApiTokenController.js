const {
  listApiTokens,
  createApiToken,
  revokeApiToken,
} = require('../services/analytics/analyticsApiTokenService');

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);
  const status = error.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: error.message || fallbackMessage,
  });
}

async function listAnalyticsApiTokens(req, res) {
  try {
    const data = await listApiTokens(req.user.organizationId);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'Error listing analytics API tokens');
  }
}

async function createAnalyticsApiToken(req, res) {
  try {
    const result = await createApiToken(req.user.organizationId, req.user, req.body || {});
    return res.status(201).json({
      success: true,
      data: result.data,
      token: result.token,
      message: 'Copy the token now — it will not be shown again.',
    });
  } catch (error) {
    return handleError(res, error, 'Error creating analytics API token');
  }
}

async function revokeAnalyticsApiToken(req, res) {
  try {
    const data = await revokeApiToken(req.params.id, req.user.organizationId, req.user);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'Error revoking analytics API token');
  }
}

module.exports = {
  listAnalyticsApiTokens,
  createAnalyticsApiToken,
  revokeAnalyticsApiToken,
};
