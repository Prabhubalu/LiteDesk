'use strict';

const { getAmdsClient, isAmdsEnvConfigured } = require('../config/amds');
const { AmdsApiError } = require('../services/amds/amds-errors');

function requireOrgAdmin(req, res) {
  if (req.user?.isOwner) return true;
  const role = String(req.user?.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin' || req.user?.isPlatformAdmin) return true;
  res.status(403).json({ success: false, message: 'Admin access required' });
  return false;
}

function amdsNotConfigured(res) {
  return res.status(503).json({
    success: false,
    message: 'AMDS is not configured on this server'
  });
}

function handleAmdsError(err, res, next) {
  if (err instanceof AmdsApiError) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      ...(err.body?.details ? { details: err.body.details } : {})
    });
  }
  return next(err);
}

/**
 * POST /api/settings/email/domains
 */
exports.registerEmailDomain = async (req, res, next) => {
  try {
    if (!requireOrgAdmin(req, res)) return;
    if (!isAmdsEnvConfigured()) return amdsNotConfigured(res);

    const domain = String(req.body?.domain || '').trim().toLowerCase();
    if (!domain || !domain.includes('.')) {
      return res.status(400).json({ success: false, message: 'Valid domain is required' });
    }

    const client = getAmdsClient();
    if (!client) return amdsNotConfigured(res);

    const result = await client.registerDomain({
      tenant_id: String(req.user.organizationId),
      domain
    });
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    return handleAmdsError(err, res, next);
  }
};

/**
 * GET /api/settings/email/domains/:domain
 */
exports.getEmailDomain = async (req, res, next) => {
  try {
    if (!requireOrgAdmin(req, res)) return;
    if (!isAmdsEnvConfigured()) return amdsNotConfigured(res);

    const domain = String(req.params.domain || '').trim().toLowerCase();
    if (!domain) {
      return res.status(400).json({ success: false, message: 'Domain is required' });
    }

    const client = getAmdsClient();
    if (!client) return amdsNotConfigured(res);

    const result = await client.getDomain(String(req.user.organizationId), domain);
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleAmdsError(err, res, next);
  }
};

/**
 * POST /api/settings/email/domains/:domain/verify
 */
exports.verifyEmailDomain = async (req, res, next) => {
  try {
    if (!requireOrgAdmin(req, res)) return;
    if (!isAmdsEnvConfigured()) return amdsNotConfigured(res);

    const domain = String(req.params.domain || '').trim().toLowerCase();
    if (!domain) {
      return res.status(400).json({ success: false, message: 'Domain is required' });
    }

    const client = getAmdsClient();
    if (!client) return amdsNotConfigured(res);

    const result = await client.verifyDomain(String(req.user.organizationId), domain);
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleAmdsError(err, res, next);
  }
};
