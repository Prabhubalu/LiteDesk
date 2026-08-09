'use strict';

const queueRoutingService = require('../services/telephony/queueRoutingService');

exports.listStrategies = async (_req, res) => {
  return res.json({ success: true, data: queueRoutingService.STRATEGIES });
};

exports.listQueues = async (req, res) => {
  try {
    const data = await queueRoutingService.listQueues(req.user.organizationId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[telephonyQueueController] listQueues', err);
    return res.status(500).json({ success: false, message: 'Failed to list queues' });
  }
};

exports.createQueue = async (req, res) => {
  try {
    const data = await queueRoutingService.createQueue(req.user.organizationId, req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[telephonyQueueController] createQueue', err);
    return res.status(500).json({ success: false, message: 'Failed to create queue' });
  }
};

exports.updateQueue = async (req, res) => {
  try {
    const data = await queueRoutingService.updateQueue(
      req.user.organizationId,
      req.params.queueId,
      req.body || {}
    );
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[telephonyQueueController] updateQueue', err);
    return res.status(500).json({ success: false, message: 'Failed to update queue' });
  }
};

exports.pickAgent = async (req, res) => {
  try {
    const data = await queueRoutingService.pickAgent(
      req.user.organizationId,
      req.params.queueId || req.body?.queueId
    );
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[telephonyQueueController] pickAgent', err);
    return res.status(500).json({ success: false, message: 'Failed to pick agent' });
  }
};
