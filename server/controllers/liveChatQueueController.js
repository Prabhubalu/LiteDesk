const {
  listQueuesForOrganization,
  getQueueById,
  createQueue,
  updateQueue,
  deleteQueue,
} = require('../services/liveChatQueueService');
const { DISTRIBUTION_MODES } = require('../models/LiveChatQueue');

exports.listQueues = async (req, res) => {
  try {
    const rows = await listQueuesForOrganization(req.user.organizationId);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[liveChatQueueController] listQueues', err);
    return res.status(500).json({ success: false, message: 'Failed to list queues' });
  }
};

exports.getQueue = async (req, res) => {
  try {
    const row = await getQueueById(req.user.organizationId, req.params.queueId);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Queue not found' });
    }
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[liveChatQueueController] getQueue', err);
    return res.status(500).json({ success: false, message: 'Failed to load queue' });
  }
};

exports.createQueue = async (req, res) => {
  try {
    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const row = await createQueue(req.user.organizationId, req.body || {});
    attachSettingsAuditDiff(res, {}, cloneForAudit(row), { body: req.body || {} });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatQueueController] createQueue', err);
    return res.status(500).json({ success: false, message: 'Failed to create queue' });
  }
};

exports.updateQueue = async (req, res) => {
  try {
    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const before = cloneForAudit(await getQueueById(req.user.organizationId, req.params.queueId));
    const row = await updateQueue(req.user.organizationId, req.params.queueId, req.body || {});
    attachSettingsAuditDiff(res, before || {}, cloneForAudit(row), { body: req.body || {} });
    return res.json({ success: true, data: row });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatQueueController] updateQueue', err);
    return res.status(500).json({ success: false, message: 'Failed to update queue' });
  }
};

exports.deleteQueue = async (req, res) => {
  try {
    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const before = cloneForAudit(await getQueueById(req.user.organizationId, req.params.queueId));
    await deleteQueue(req.user.organizationId, req.params.queueId);
    attachSettingsAuditDiff(res, before || {}, {}, { keys: Object.keys(before || { name: null }) });
    return res.json({ success: true, message: 'Queue deleted' });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatQueueController] deleteQueue', err);
    return res.status(500).json({ success: false, message: 'Failed to delete queue' });
  }
};

exports.listDistributionModes = async (_req, res) => {
  return res.json({ success: true, data: DISTRIBUTION_MODES });
};
