'use strict';

const presenceService = require('../services/telephony/presenceService');

exports.listPresenceStatuses = async (_req, res) => {
  return res.json({ success: true, data: presenceService.PRESENCE_STATUSES });
};

exports.getMyPresence = async (req, res) => {
  try {
    const data = await presenceService.getPresence(req.user.organizationId, req.user._id);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[telephonyPresenceController] getMyPresence', err);
    return res.status(500).json({ success: false, message: 'Failed to load presence' });
  }
};

exports.setMyPresence = async (req, res) => {
  try {
    const data = await presenceService.setPresence(
      req.user.organizationId,
      req.user._id,
      req.body?.status,
      { currentCallId: req.body?.currentCallId }
    );
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[telephonyPresenceController] setMyPresence', err);
    return res.status(500).json({ success: false, message: 'Failed to update presence' });
  }
};

exports.listAgents = async (req, res) => {
  try {
    const data = await presenceService.listAgents(req.user.organizationId, {
      status: req.query.status,
    });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[telephonyPresenceController] listAgents', err);
    return res.status(500).json({ success: false, message: 'Failed to list agents' });
  }
};
