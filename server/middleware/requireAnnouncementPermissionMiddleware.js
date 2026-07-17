const {
  canViewAnnouncements,
  canManageAnnouncements,
  canPublishAnnouncements,
  canViewAnnouncementAnalytics,
} = require('../utils/announcementPermissionUtils');

const CHECKS = {
  view: canViewAnnouncements,
  manage: canManageAnnouncements,
  publish: canPublishAnnouncements,
  analytics: canViewAnnouncementAnalytics,
};

function requireAnnouncementPermission(action) {
  const check = CHECKS[action] || CHECKS.view;
  return (req, res, next) => {
    if (!check(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission for this announcements action',
        code: 'ANNOUNCEMENTS_FORBIDDEN',
      });
    }
    return next();
  };
}

module.exports = {
  requireAnnouncementPermission,
};
