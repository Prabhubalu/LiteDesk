const {
  getPresenceForUser,
  setPresenceForUser,
  PRESENCE_STATUSES,
} = require('../services/liveChatPresenceService');

exports.getMyPresence = async (req, res) => {
  try {
    const data = await getPresenceForUser(req.user.organizationId, req.user._id);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[liveChatPresenceController] getMyPresence', err);
    return res.status(500).json({ success: false, message: 'Failed to load presence' });
  }
};

exports.setMyPresence = async (req, res) => {
  try {
    const data = await setPresenceForUser(
      req.user.organizationId,
      req.user._id,
      req.body?.status,
    );
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatPresenceController] setMyPresence', err);
    return res.status(500).json({ success: false, message: 'Failed to update presence' });
  }
};

exports.listPresenceStatuses = async (_req, res) => {
  return res.json({ success: true, data: PRESENCE_STATUSES });
};
