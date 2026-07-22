const {
  listBotsForOrganization,
  getBotById,
  createBot,
  updateBot,
  deleteBot,
} = require('../services/liveChatBotService');
const { getBotDeflectionMetrics } = require('../services/liveChatBotDeflectionService');

exports.listBots = async (req, res) => {
  try {
    const rows = await listBotsForOrganization(req.user.organizationId);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[liveChatBotController] listBots', err);
    return res.status(500).json({ success: false, message: 'Failed to list bots' });
  }
};

exports.getDeflectionMetrics = async (req, res) => {
  try {
    const metrics = await getBotDeflectionMetrics({
      organizationId: req.user.organizationId,
      sinceDays: req.query?.days,
    });
    return res.json({ success: true, data: metrics });
  } catch (err) {
    console.error('[liveChatBotController] getDeflectionMetrics', err);
    return res.status(500).json({ success: false, message: 'Failed to load deflection metrics' });
  }
};

exports.getBot = async (req, res) => {
  try {
    const row = await getBotById(req.user.organizationId, req.params.botId);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Bot not found' });
    }
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[liveChatBotController] getBot', err);
    return res.status(500).json({ success: false, message: 'Failed to load bot' });
  }
};

exports.createBot = async (req, res) => {
  try {
    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const row = await createBot(req.user.organizationId, req.body || {});
    attachSettingsAuditDiff(res, {}, cloneForAudit(row), { body: req.body || {} });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatBotController] createBot', err);
    return res.status(500).json({ success: false, message: 'Failed to create bot' });
  }
};

exports.updateBot = async (req, res) => {
  try {
    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const before = cloneForAudit(await getBotById(req.user.organizationId, req.params.botId));
    const row = await updateBot(req.user.organizationId, req.params.botId, req.body || {});
    attachSettingsAuditDiff(res, before || {}, cloneForAudit(row), { body: req.body || {} });
    return res.json({ success: true, data: row });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatBotController] updateBot', err);
    return res.status(500).json({ success: false, message: 'Failed to update bot' });
  }
};

exports.deleteBot = async (req, res) => {
  try {
    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const before = cloneForAudit(await getBotById(req.user.organizationId, req.params.botId));
    await deleteBot(req.user.organizationId, req.params.botId);
    attachSettingsAuditDiff(res, before || {}, {}, { keys: Object.keys(before || { name: null }) });
    return res.json({ success: true, message: 'Bot deleted' });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatBotController] deleteBot', err);
    return res.status(500).json({ success: false, message: 'Failed to delete bot' });
  }
};
