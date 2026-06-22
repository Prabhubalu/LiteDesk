'use strict';

const { canAdminLiveChat } = require('../utils/liveChatPermissionUtils');
const {
  getSessionFieldConfigForViewer,
} = require('../services/liveChatSessionFieldConfigService');

exports.getSessionFields = async (req, res) => {
  try {
    const isAdmin = canAdminLiveChat(req.user);
    const data = await getSessionFieldConfigForViewer({
      organizationId: req.user.organizationId,
      isAdmin,
    });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[liveChatSessionFieldController] getSessionFields', err);
    return res.status(500).json({ success: false, message: 'Failed to load session fields' });
  }
};
