'use strict';

const ivrService = require('../services/telephony/ivrService');

exports.listFlows = async (req, res) => {
  try {
    const data = await ivrService.listFlows(req.user.organizationId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[telephonyIvrController] listFlows', err);
    return res.status(500).json({ success: false, message: 'Failed to list IVR flows' });
  }
};

exports.getFlow = async (req, res) => {
  try {
    const data = await ivrService.getFlow(req.user.organizationId, req.params.flowId);
    if (!data) return res.status(404).json({ success: false, message: 'IVR flow not found' });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[telephonyIvrController] getFlow', err);
    return res.status(500).json({ success: false, message: 'Failed to load IVR flow' });
  }
};

exports.createFlow = async (req, res) => {
  try {
    const data = await ivrService.createFlow(req.user.organizationId, req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[telephonyIvrController] createFlow', err);
    return res.status(500).json({ success: false, message: 'Failed to create IVR flow' });
  }
};

exports.updateFlow = async (req, res) => {
  try {
    const data = await ivrService.updateFlow(
      req.user.organizationId,
      req.params.flowId,
      req.body || {}
    );
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[telephonyIvrController] updateFlow', err);
    return res.status(500).json({ success: false, message: 'Failed to update IVR flow' });
  }
};

exports.publishFlow = async (req, res) => {
  try {
    const data = await ivrService.publishFlow(req.user.organizationId, req.params.flowId);
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[telephonyIvrController] publishFlow', err);
    return res.status(500).json({ success: false, message: 'Failed to publish IVR flow' });
  }
};

exports.deleteFlow = async (req, res) => {
  try {
    const data = await ivrService.deleteFlow(req.user.organizationId, req.params.flowId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[telephonyIvrController] deleteFlow', err);
    return res.status(500).json({ success: false, message: 'Failed to delete IVR flow' });
  }
};
