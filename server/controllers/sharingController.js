const ModuleSharingDefault = require('../models/ModuleSharingDefault');
const { SHARING_MODES } = require('../models/ModuleSharingDefault');
const { isSharingV1Enabled } = require('../utils/rbacFeatureFlags');
const { buildDefaultSharingEntries } = require('../services/sharingSeedService');
const { seedSharingDefaultsForOrganization } = require('../services/sharingSeedService');
const Organization = require('../models/Organization');
const ModuleSharingRule = require('../models/ModuleSharingRule');
const {
  SOURCE_TYPES,
  TARGET_TYPES,
  PRIVILEGES
} = require('../models/ModuleSharingRule');
const { validateRuleParty } = require('../services/sharingRuleService');

async function loadOrganization(req) {
  return req.organization || (await Organization.findById(req.user.organizationId).lean());
}

async function ensureSharingEnabled(req, res) {
  const organization = await loadOrganization(req);
  if (!isSharingV1Enabled(organization)) {
    res.status(403).json({
      success: false,
      message: 'Sharing v1 is not enabled for this organization',
      code: 'SHARING_V1_DISABLED'
    });
    return null;
  }
  return organization;
}

function normalizeRulePayload(body) {
  return {
    name: body.name ? String(body.name).trim() : '',
    appKey: body.appKey ? String(body.appKey).toUpperCase() : '',
    moduleKey: body.moduleKey ? String(body.moduleKey).toLowerCase() : '',
    priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : 100,
    enabled: body.enabled !== false,
    privilege: body.privilege || 'read',
    source: body.source || {},
    target: body.target || {}
  };
}

function validateRulePayload(payload) {
  if (!payload.name) return 'Rule name is required';
  if (!payload.appKey || !payload.moduleKey) return 'appKey and moduleKey are required';
  if (!PRIVILEGES.includes(payload.privilege)) return 'Invalid privilege';

  const sourceErr = validateRuleParty(payload.source, SOURCE_TYPES, 'Source');
  if (sourceErr) return sourceErr;
  const targetErr = validateRuleParty(payload.target, TARGET_TYPES, 'Target');
  if (targetErr) return targetErr;

  return null;
}

function mergeSharingDefaultRows(rows, catalogEntries) {
  const byKey = new Map(
    (rows || []).map((row) => [
      `${String(row.appKey || '').toUpperCase()}:${String(row.moduleKey || '').toLowerCase()}`,
      row
    ])
  );

  for (const entry of catalogEntries || []) {
    const key = `${String(entry.appKey || '').toUpperCase()}:${String(entry.moduleKey || '').toLowerCase()}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        appKey: String(entry.appKey || '').toUpperCase(),
        moduleKey: String(entry.moduleKey || '').toLowerCase(),
        mode: entry.mode || 'private'
      });
    }
  }

  return [...byKey.values()].sort(
    (a, b) =>
      String(a.appKey || '').localeCompare(String(b.appKey || ''))
      || String(a.moduleKey || '').localeCompare(String(b.moduleKey || ''))
  );
}

exports.listSharingDefaults = async (req, res) => {
  try {
    const organization = await ensureSharingEnabled(req, res);
    if (!organization) return;

    const appKey = req.query.appKey ? String(req.query.appKey).toUpperCase() : null;
    const filter = { organizationId: req.user.organizationId };
    if (appKey) filter.appKey = appKey;

    let rows = await ModuleSharingDefault.find(filter)
      .sort({ appKey: 1, moduleKey: 1 })
      .lean();

    await seedSharingDefaultsForOrganization(req.user.organizationId, organization, {
      updatedBy: req.user._id
    });
    rows = await ModuleSharingDefault.find(filter).sort({ appKey: 1, moduleKey: 1 }).lean();

    const catalog = await buildDefaultSharingEntries(req.user.organizationId, organization);
    const mergedRows = mergeSharingDefaultRows(rows, catalog);

    res.json({
      success: true,
      data: mergedRows,
      catalog,
      modes: SHARING_MODES
    });
  } catch (error) {
    console.error('List sharing defaults error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sharing defaults',
      error: error.message
    });
  }
};

exports.updateSharingDefault = async (req, res) => {
  try {
    const organization = await ensureSharingEnabled(req, res);
    if (!organization) return;

    const appKey = String(req.params.appKey || '').toUpperCase();
    const moduleKey = String(req.params.moduleKey || '').toLowerCase();
    const { mode } = req.body;

    if (!appKey || !moduleKey) {
      return res.status(400).json({ success: false, message: 'appKey and moduleKey are required' });
    }
    if (!SHARING_MODES.includes(mode)) {
      return res.status(400).json({
        success: false,
        message: `Invalid mode. Allowed: ${SHARING_MODES.join(', ')}`
      });
    }

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const previous = await ModuleSharingDefault.findOne({
      organizationId: req.user.organizationId,
      appKey,
      moduleKey
    }).lean();
    const before = cloneForAudit({ mode: previous?.mode || null });

    const row = await ModuleSharingDefault.findOneAndUpdate(
      {
        organizationId: req.user.organizationId,
        appKey,
        moduleKey
      },
      {
        mode,
        updatedBy: req.user._id
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    attachSettingsAuditDiff(res, before, cloneForAudit({ mode: row.mode }), { keys: ['mode'] });

    res.json({
      success: true,
      data: row,
      message: 'Sharing default updated'
    });
  } catch (error) {
    console.error('Update sharing default error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating sharing default',
      error: error.message
    });
  }
};

exports.seedSharingDefaults = async (req, res) => {
  try {
    const organization = await ensureSharingEnabled(req, res);
    if (!organization) return;

    const result = await seedSharingDefaultsForOrganization(req.user.organizationId, organization, {
      updatedBy: req.user._id
    });

    res.json({
      success: true,
      data: result,
      message: 'Sharing defaults seeded'
    });
  } catch (error) {
    console.error('Seed sharing defaults error:', error);
    res.status(500).json({
      success: false,
      message: 'Error seeding sharing defaults',
      error: error.message
    });
  }
};

exports.listSharingRules = async (req, res) => {
  try {
    const organization = await ensureSharingEnabled(req, res);
    if (!organization) return;

    const filter = { organizationId: req.user.organizationId };
    if (req.query.appKey) filter.appKey = String(req.query.appKey).toUpperCase();
    if (req.query.moduleKey) filter.moduleKey = String(req.query.moduleKey).toLowerCase();

    const rules = await ModuleSharingRule.find(filter)
      .sort({ appKey: 1, moduleKey: 1, priority: 1, createdAt: 1 })
      .lean();

    res.json({
      success: true,
      data: rules,
      sourceTypes: SOURCE_TYPES,
      targetTypes: TARGET_TYPES,
      privileges: PRIVILEGES
    });
  } catch (error) {
    console.error('List sharing rules error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sharing rules',
      error: error.message
    });
  }
};

exports.createSharingRule = async (req, res) => {
  try {
    const organization = await ensureSharingEnabled(req, res);
    if (!organization) return;

    const payload = normalizeRulePayload(req.body);
    const validationError = validateRulePayload(payload);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const rule = await ModuleSharingRule.create({
      organizationId: req.user.organizationId,
      ...payload,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    attachSettingsAuditDiff(res, {}, cloneForAudit(rule.toObject()), { body: req.body || {} });

    res.status(201).json({
      success: true,
      data: rule.toObject(),
      message: 'Sharing rule created'
    });
  } catch (error) {
    console.error('Create sharing rule error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating sharing rule',
      error: error.message
    });
  }
};

exports.updateSharingRule = async (req, res) => {
  try {
    const organization = await ensureSharingEnabled(req, res);
    if (!organization) return;

    const rule = await ModuleSharingRule.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Sharing rule not found' });
    }

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const before = cloneForAudit(rule.toObject());

    const payload = normalizeRulePayload({ ...rule.toObject(), ...req.body });
    const validationError = validateRulePayload(payload);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    rule.name = payload.name;
    rule.priority = payload.priority;
    rule.enabled = payload.enabled;
    rule.privilege = payload.privilege;
    rule.source = payload.source;
    rule.target = payload.target;
    rule.updatedBy = req.user._id;
    await rule.save();

    attachSettingsAuditDiff(res, before, cloneForAudit(rule.toObject()), { body: req.body || {} });

    res.json({
      success: true,
      data: rule.toObject(),
      message: 'Sharing rule updated'
    });
  } catch (error) {
    console.error('Update sharing rule error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating sharing rule',
      error: error.message
    });
  }
};

exports.deleteSharingRule = async (req, res) => {
  try {
    const organization = await ensureSharingEnabled(req, res);
    if (!organization) return;

    const rule = await ModuleSharingRule.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Sharing rule not found' });
    }

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    attachSettingsAuditDiff(res, cloneForAudit(rule.toObject()), {}, { keys: ['name', 'enabled', 'privilege'] });

    res.json({ success: true, message: 'Sharing rule deleted' });
  } catch (error) {
    console.error('Delete sharing rule error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting sharing rule',
      error: error.message
    });
  }
};
