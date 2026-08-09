'use strict';

const {
  canViewTelephony,
  canPlaceTelephonyCalls,
  canListenTelephonyRecordings,
  canDownloadTelephonyRecordings,
  canManageTelephony,
  canAdminTelephony,
  canAccessTelephonyAi,
} = require('../utils/telephonyPermissionUtils');

function requireTelephonyPermission(action) {
  return (req, res, next) => {
    const user = req.user;
    let allowed = false;

    switch (action) {
      case 'view':
        allowed = canViewTelephony(user);
        break;
      case 'call':
        allowed = canPlaceTelephonyCalls(user);
        break;
      case 'listen':
        allowed = canListenTelephonyRecordings(user);
        break;
      case 'download':
        allowed = canDownloadTelephonyRecordings(user);
        break;
      case 'manage':
        allowed = canManageTelephony(user);
        break;
      case 'admin':
        allowed = canAdminTelephony(user);
        break;
      case 'ai':
        allowed = canAccessTelephonyAi(user);
        break;
      default:
        allowed = false;
    }

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient Telephony permissions',
        code: 'FORBIDDEN',
      });
    }

    return next();
  };
}

module.exports = {
  requireTelephonyPermission,
};
