const {
  canViewLiveChatSessions,
  canReplyLiveChatSessions,
  canAdminLiveChat,
} = require('../utils/liveChatPermissionUtils');

function requireLiveChatPermission(action) {
  return (req, res, next) => {
    const user = req.user;
    let allowed = false;

    switch (action) {
      case 'view':
        allowed = canViewLiveChatSessions(user);
        break;
      case 'reply':
        allowed = canReplyLiveChatSessions(user);
        break;
      case 'admin':
        allowed = canAdminLiveChat(user);
        break;
      default:
        allowed = false;
    }

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient Live Chat permissions',
        code: 'FORBIDDEN',
      });
    }

    return next();
  };
}

module.exports = {
  requireLiveChatPermission,
};
