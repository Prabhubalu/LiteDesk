const mailroomConfigService = require('../../../../services/mailroomConfigService');

function extractBearerToken(req) {
  const auth = String(req.headers.authorization || '').trim();
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return null;
}

function getOrganizationIdFromRequest(req) {
  return req.headers['x-organization-id']
    || req.headers['x-org-id']
    || req.body?.organizationId
    || req.body?.orgId
    || null;
}

async function authenticatePublicMailroomRequest(req) {
  const organizationId = getOrganizationIdFromRequest(req);
  if (!organizationId) {
    const err = new Error('organizationId is required (X-Organization-Id header or body)');
    err.statusCode = 400;
    throw err;
  }

  const config = await mailroomConfigService.getOrCreateConfig(organizationId);
  const key = extractBearerToken(req) || String(req.headers['x-mailroom-api-key'] || '').trim();
  const expected = String(config?.connectors?.publicApi?.ingestKey || '').trim();

  if (!config?.connectors?.publicApi?.enabled) {
    const err = new Error('Mailroom public API connector is disabled');
    err.statusCode = 403;
    throw err;
  }
  if (!expected || !key || key !== expected) {
    const err = new Error('Invalid Mailroom API key');
    err.statusCode = 401;
    throw err;
  }

  return { organizationId, config };
}

module.exports = {
  extractBearerToken,
  getOrganizationIdFromRequest,
  authenticatePublicMailroomRequest
};
