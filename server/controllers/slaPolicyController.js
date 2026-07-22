'use strict';

const SlaPolicy = require('../models/SlaPolicy');
const { buildSlaPolicyMetadata } = require('../constants/slaPolicy');
const { getAdapter } = require('../services/sla/slaModuleRegistry');
const { simulatePolicyMatch } = require('../services/sla/slaPolicyEngine');
const {
  migrateHelpdeskPoliciesToGeneric,
  ensureDefaultSlaPolicy,
  ensureDefaultSlaPolicyForModule,
  syncDefaultPolicyToLegacySettings,
  setDefaultSlaPolicy,
  DEFAULT_SLA_POLICY_KEY
} = require('../services/sla/slaPolicyMigrationService');
const {
  listTenantSlaModules,
  getSlaModuleConditionFields,
  resolveModuleAppKey
} = require('../services/sla/slaModuleMetadataService');

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeConditionGroup(raw) {
  if (!isPlainObject(raw)) return { combinator: 'all', clauses: [], groups: [] };
  const combinator = raw.combinator === 'any' ? 'any' : 'all';
  const clauses = Array.isArray(raw.clauses)
    ? raw.clauses
      .map((c) => ({
        field: String(c.field || '').trim(),
        operator: String(c.operator || 'equals').trim(),
        value: c.value
      }))
      .filter((c) => c.field)
    : [];
  const groups = Array.isArray(raw.groups)
    ? raw.groups.map((g) => sanitizeConditionGroup(g))
    : [];
  return { combinator, clauses, groups };
}

function sanitizePolicyBody(body, organizationId) {
  const scope = isPlainObject(body.scope) ? body.scope : {};
  return {
    organizationId,
    policyKey: String(body.policyKey || '').trim(),
    name: String(body.name || '').trim(),
    description: String(body.description || ''),
    active: body.active !== false,
    precedence: Number.isFinite(Number(body.precedence)) ? Number(body.precedence) : 0,
    isDefault: Boolean(body.isDefault),
    executionMode: body.executionMode || 'first_match',
    scope: {
      appKey: scope.appKey ? String(scope.appKey).toUpperCase() : null,
      moduleKey: String(scope.moduleKey || 'cases').toLowerCase(),
      recordType: scope.recordType ? String(scope.recordType) : null
    },
    entryCriteria: sanitizeConditionGroup(body.entryCriteria),
    trigger: isPlainObject(body.trigger) ? body.trigger : { type: 'record_created' },
    targets: Array.isArray(body.targets) ? body.targets : [],
    pauseConditions: Array.isArray(body.pauseConditions)
      ? body.pauseConditions.map(sanitizeConditionGroup)
      : [],
    resumeConditions: Array.isArray(body.resumeConditions)
      ? body.resumeConditions.map(sanitizeConditionGroup)
      : [],
    successCriteria: sanitizeConditionGroup(body.successCriteria),
    breachConditions: sanitizeConditionGroup(body.breachConditions),
    notifications: Array.isArray(body.notifications) ? body.notifications : [],
    escalations: isPlainObject(body.escalations) ? body.escalations : { enabled: false, steps: [] },
    calendar: isPlainObject(body.calendar) ? body.calendar : { mode: 'business' },
    advanced: isPlainObject(body.advanced) ? body.advanced : {}
  };
}

exports.getSlaPolicyMetadata = async (req, res) => {
  try {
    const moduleKey = req.query.moduleKey ? String(req.query.moduleKey).toLowerCase() : null;
    const modules = await listTenantSlaModules(req.user.organizationId);
    const moduleRow = moduleKey
      ? modules.find((row) => row.moduleKey === moduleKey)
      : null;
    const resolvedAppKey = moduleKey
      ? (moduleRow?.appKey || await resolveModuleAppKey(req.user.organizationId, moduleKey, req.query.appKey))
      : null;
    const adapter = moduleKey
      ? getAdapter(moduleKey, { appKey: resolvedAppKey || req.query.appKey })
      : null;

    const moduleFields = moduleKey
      ? await getSlaModuleConditionFields(
        req.user.organizationId,
        resolvedAppKey || req.query.appKey,
        moduleKey
      )
      : [];

    return res.json({
      success: true,
      metadata: buildSlaPolicyMetadata(adapter),
      modules,
      moduleFields,
      adapter: adapter ? {
        moduleKey: adapter.moduleKey,
        milestoneKeys: adapter.milestoneKeys,
        priorityDimension: adapter.priorityDimension,
        generic: Boolean(adapter.generic)
      } : null
    });
  } catch (error) {
    console.error('[slaPolicyController] getSlaPolicyMetadata', error);
    return res.status(500).json({ success: false, message: 'Failed to load SLA metadata' });
  }
};

exports.listSlaPolicies = async (req, res) => {
  try {
    const moduleKey = req.query.moduleKey ? String(req.query.moduleKey).toLowerCase() : null;
    if (moduleKey) {
      const modules = await listTenantSlaModules(req.user.organizationId);
      const moduleRow = modules.find((row) => row.moduleKey === moduleKey);
      await ensureDefaultSlaPolicyForModule(
        req.user.organizationId,
        moduleKey,
        moduleRow?.appKey || null
      );
    } else {
      await ensureDefaultSlaPolicy(req.user.organizationId);
    }

    const filter = {
      organizationId: req.user.organizationId,
      deletedAt: null
    };
    if (moduleKey) {
      filter['scope.moduleKey'] = moduleKey;
    }
    if (req.query.active === 'true') filter.active = true;
    if (req.query.active === 'false') filter.active = false;

    const policies = await SlaPolicy.find(filter)
      .sort({ isDefault: -1, precedence: -1, name: 1 })
      .lean();

    return res.json({ success: true, policies, defaultPolicyKey: DEFAULT_SLA_POLICY_KEY });
  } catch (error) {
    console.error('[slaPolicyController] listSlaPolicies', error);
    return res.status(500).json({ success: false, message: 'Failed to list SLA policies' });
  }
};

exports.getSlaPolicy = async (req, res) => {
  try {
    const policy = await SlaPolicy.findOne({
      organizationId: req.user.organizationId,
      policyKey: req.params.policyKey,
      deletedAt: null
    }).lean();

    if (!policy) {
      return res.status(404).json({ success: false, message: 'SLA policy not found' });
    }
    return res.json({ success: true, policy });
  } catch (error) {
    console.error('[slaPolicyController] getSlaPolicy', error);
    return res.status(500).json({ success: false, message: 'Failed to load SLA policy' });
  }
};

exports.upsertSlaPolicy = async (req, res) => {
  try {
    const body = { ...req.body, policyKey: req.params.policyKey || req.body.policyKey };
    const moduleKey = String(body?.scope?.moduleKey || 'cases').toLowerCase();
    const resolvedAppKey = await resolveModuleAppKey(
      req.user.organizationId,
      moduleKey,
      body?.scope?.appKey
    );
    if (resolvedAppKey) {
      body.scope = { ...(body.scope || {}), appKey: resolvedAppKey };
    }

    const sanitized = sanitizePolicyBody(body, req.user.organizationId);

    if (!sanitized.policyKey) {
      return res.status(400).json({ success: false, message: 'policyKey is required' });
    }
    if (!sanitized.name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }

    if (sanitized.isDefault) {
      await SlaPolicy.updateMany(
        {
          organizationId: req.user.organizationId,
          'scope.moduleKey': sanitized.scope.moduleKey,
          deletedAt: null,
          policyKey: { $ne: sanitized.policyKey }
        },
        { $set: { isDefault: false } }
      );
    }

    const existing = await SlaPolicy.findOne({
      organizationId: req.user.organizationId,
      policyKey: sanitized.policyKey,
      deletedAt: null
    });

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');

    if (existing) {
      const before = cloneForAudit(existing.toObject());
      Object.assign(existing, sanitized);
      existing.version = (existing.version || 1) + 1;
      await existing.save();
      if (existing.policyKey === DEFAULT_SLA_POLICY_KEY) {
        await syncDefaultPolicyToLegacySettings(req.user.organizationId, existing.toObject());
      }
      if (existing.isDefault) {
        await setDefaultSlaPolicy(req.user.organizationId, existing.policyKey, existing.scope?.moduleKey);
      }
      attachSettingsAuditDiff(res, before, cloneForAudit(existing.toObject()), { body: req.body || {} });
      return res.json({ success: true, policy: existing.toObject(), created: false });
    }

    const created = await SlaPolicy.create(sanitized);
    if (created.policyKey === DEFAULT_SLA_POLICY_KEY) {
      await syncDefaultPolicyToLegacySettings(req.user.organizationId, created.toObject());
    }
    if (created.isDefault) {
      await setDefaultSlaPolicy(req.user.organizationId, created.policyKey, created.scope?.moduleKey);
    }
    attachSettingsAuditDiff(res, {}, cloneForAudit(created.toObject()), { body: req.body || {} });
    return res.status(201).json({ success: true, policy: created.toObject(), created: true });
  } catch (error) {
    console.error('[slaPolicyController] upsertSlaPolicy', error);
    return res.status(500).json({ success: false, message: 'Failed to save SLA policy' });
  }
};

exports.deleteSlaPolicy = async (req, res) => {
  try {
    if (req.params.policyKey === DEFAULT_SLA_POLICY_KEY) {
      return res.status(400).json({ success: false, message: 'Default SLA policy cannot be deleted' });
    }
    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const existing = await SlaPolicy.findOne({
      organizationId: req.user.organizationId,
      policyKey: req.params.policyKey,
      deletedAt: null
    }).lean();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'SLA policy not found' });
    }
    const before = cloneForAudit(existing);

    const result = await SlaPolicy.updateOne(
      {
        organizationId: req.user.organizationId,
        policyKey: req.params.policyKey,
        deletedAt: null
      },
      { $set: { active: false, deletedAt: new Date() } }
    );

    if (!result.matchedCount) {
      return res.status(404).json({ success: false, message: 'SLA policy not found' });
    }
    attachSettingsAuditDiff(res, before, {}, { keys: Object.keys(before || {}) });
    return res.json({ success: true });
  } catch (error) {
    console.error('[slaPolicyController] deleteSlaPolicy', error);
    return res.status(500).json({ success: false, message: 'Failed to delete SLA policy' });
  }
};

exports.simulateSlaPolicy = async (req, res) => {
  try {
    const moduleKey = String(req.body?.moduleKey || 'cases').toLowerCase();
    const sampleRecord = req.body?.sampleRecord || req.body?.record || {};
    const event = req.body?.event || { type: 'record_created' };

    const result = await simulatePolicyMatch({
      organizationId: req.user.organizationId,
      moduleKey,
      sampleRecord,
      event
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[slaPolicyController] simulateSlaPolicy', error);
    return res.status(500).json({ success: false, message: 'Simulation failed' });
  }
};

exports.migrateHelpdeskSlaPolicies = async (req, res) => {
  try {
    const result = await migrateHelpdeskPoliciesToGeneric(req.user.organizationId);
    return res.json({ success: true, result });
  } catch (error) {
    console.error('[slaPolicyController] migrateHelpdeskSlaPolicies', error);
    return res.status(500).json({ success: false, message: 'Migration failed' });
  }
};

exports.setDefaultSlaPolicy = async (req, res) => {
  try {
    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const moduleKey = String(req.body?.moduleKey || req.query?.moduleKey || 'cases').toLowerCase();
    const previousDefault = await SlaPolicy.findOne({
      organizationId: req.user.organizationId,
      'scope.moduleKey': moduleKey,
      isDefault: true,
      deletedAt: null
    }).select('policyKey isDefault').lean();
    const before = cloneForAudit({
      defaultPolicyKey: previousDefault?.policyKey || null,
      isDefault: true
    });

    const policy = await setDefaultSlaPolicy(
      req.user.organizationId,
      req.params.policyKey,
      moduleKey
    );
    if (!policy) {
      return res.status(404).json({ success: false, message: 'SLA policy not found' });
    }
    attachSettingsAuditDiff(
      res,
      before,
      cloneForAudit({ defaultPolicyKey: policy.policyKey, isDefault: true }),
      { keys: ['defaultPolicyKey', 'isDefault'] }
    );
    return res.json({ success: true, policy });
  } catch (error) {
    console.error('[slaPolicyController] setDefaultSlaPolicy', error);
    return res.status(500).json({ success: false, message: 'Failed to set default SLA policy' });
  }
};
