'use strict';

const { isAstraStudioEnabled } = require('../services/astraStudio/flags');

function requireAstraStudioEnabled(req, res, next) {
  if (!isAstraStudioEnabled()) {
    return res.status(404).json({
      success: false,
      message: 'Astra Studio is not enabled',
      code: 'ASTRA_STUDIO_DISABLED',
    });
  }
  return next();
}

module.exports = {
  requireAstraStudioEnabled,
};
