const { APP_KEYS } = require('../constants/appKeys');

const requireMarketingApp = (req, res, next) => {
  if (!req.appKey) {
    return res.status(403).json({
      success: false,
      message: 'This endpoint requires Marketing application context',
      code: 'MARKETING_APP_REQUIRED',
      error: 'Application context not resolved.'
    });
  }

  if (req.appKey !== APP_KEYS.MARKETING) {
    return res.status(403).json({
      success: false,
      message: 'This endpoint is only accessible from the Marketing application',
      code: 'MARKETING_APP_REQUIRED',
      currentApp: req.appKey,
      requiredApp: APP_KEYS.MARKETING
    });
  }

  return next();
};

module.exports = {
  requireMarketingApp
};
