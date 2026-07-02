'use strict';

const { getAmdsClient, isAmdsEnvConfigured } = require('../config/amds');
const { AmdsApiError } = require('../services/amds/amds-errors');

function handleAmdsError(err, res, next) {
  if (err instanceof AmdsApiError) {
    return res.status(err.status).json({
      success: false,
      message: err.userMessage || err.message
    });
  }
  return next(err);
}

/**
 * GET /api/platform/amds/infra/status
 */
exports.getInfraStatus = async (req, res, next) => {
  try {
    if (!isAmdsEnvConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'AMDS is not configured on this server'
      });
    }

    const client = getAmdsClient();
    if (!client) {
      return res.status(503).json({
        success: false,
        message: 'AMDS is not configured on this server'
      });
    }

    const status = await client.getInfraStatus();
    return res.json({ success: true, data: status });
  } catch (err) {
    return handleAmdsError(err, res, next);
  }
};
