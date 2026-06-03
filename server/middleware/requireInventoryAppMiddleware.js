const { APP_KEYS } = require('../constants/appKeys');

const requireInventoryApp = (req, res, next) => {
  if (!req.appKey) {
    console.warn(`[InventoryApp] req.appKey not set for path: ${req.path}`);
    return res.status(403).json({
      success: false,
      message: 'This endpoint requires Inventory application context',
      code: 'INVENTORY_APP_REQUIRED'
    });
  }

  if (req.appKey !== APP_KEYS.INVENTORY) {
    const userId = req.user?._id?.toString() || 'unknown';
    const orgId = req.user?.organizationId?.toString() || 'unknown';
    console.warn(
      `[InventoryApp] Blocked access: appKey=${req.appKey} path=${req.path} userId=${userId} orgId=${orgId}`
    );
    return res.status(403).json({
      success: false,
      message: 'This endpoint is only accessible from the Inventory application',
      code: 'INVENTORY_APP_REQUIRED',
      currentApp: req.appKey,
      requiredApp: APP_KEYS.INVENTORY
    });
  }

  next();
};

module.exports = {
  requireInventoryApp
};
