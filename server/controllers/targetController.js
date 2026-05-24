'use strict';

const Target = require('../models/Target');
const TargetTypeDefinition = require('../models/TargetTypeDefinition');
const TargetPlatformSettings = require('../models/TargetPlatformSettings');
const TargetContributionLedger = require('../models/TargetContributionLedger');
const TargetAssignment = require('../models/TargetAssignment');
const { assertTargetPermission } = require('../services/targets/targetPermissionUtils');
const { listTargetTypes, ensureDefaultTargetTypes } = require('../services/targets/targetTypeService');
const { detectConflicts } = require('../services/targets/targetConflictService');
const { publishTargetVersion, listTargetVersions } = require('../services/targets/targetVersionService');
const { syncAssignmentsFromDistribution, applyDistributionChange } = require('../services/targets/targetDistributionService');
const { resolveDependencyWarnings } = require('../services/targets/targetDependencyResolver');
const { buildDefaultRule } = require('../services/targets/contributionRuleRegistry');
const { emitTargetActivated } = require('../services/targets/targetAutomationEmitter');
const { recalculateTargetFromLedger, sumLedgerForTarget, refreshTargetAchievedFromLedger } = require('../services/targets/targetAggregator');
const { recomputeTargetForecast, getForecastBreakdown } = require('../services/targets/targetForecastService');
const { getLeaderboard } = require('../services/targets/targetGamificationService');
const { TARGET_LIFECYCLE } = require('../constants/targetConstants');

function handleError(res, err, fallback) {
  const status = err.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: err.message || fallback,
    code: err.code
  });
}

function normalizeTargetPeriodBounds(payload) {
  if (payload.periodStart) {
    const start = new Date(payload.periodStart);
    start.setUTCHours(0, 0, 0, 0);
    payload.periodStart = start;
  }
  if (payload.periodEnd) {
    const end = new Date(payload.periodEnd);
    end.setUTCHours(23, 59, 59, 999);
    payload.periodEnd = end;
  }
  return payload;
}

function pickTargetPayload(body) {
  const payload = {
    name: body.name,
    description: body.description,
    targetTypeKey: body.targetTypeKey,
    metricKind: body.metricKind,
    ownerId: body.ownerId,
    teamId: body.teamId,
    sourceModules: body.sourceModules,
    contributionRules: body.contributionRules,
    targetValue: body.targetValue,
    distributionType: body.distributionType,
    periodStart: body.periodStart,
    periodEnd: body.periodEnd,
    thresholds: body.thresholds,
    forecastRules: body.forecastRules
  };
  return normalizeTargetPeriodBounds(payload);
}

async function reconcileTargetAchieved(target) {
  if (!target || !['active', 'locked'].includes(target.lifecycleStatus)) return target;
  const ledgerTotal = await sumLedgerForTarget(target._id);
  if (Math.abs((Number(target.achievedValue) || 0) - ledgerTotal) < 0.001) return target;
  const updated = await refreshTargetAchievedFromLedger(target._id);
  return updated?.toObject ? updated.toObject() : updated || target;
}

exports.listTargets = async (req, res) => {
  try {
    assertTargetPermission(req.user, 'view');
    const { lifecycleStatus, ownerId, limit = 50, skip = 0 } = req.query;
    const filter = { organizationId: req.user.organizationId };
    if (lifecycleStatus) filter.lifecycleStatus = lifecycleStatus;
    if (ownerId) filter.ownerId = ownerId;

    const [items, total] = await Promise.all([
      Target.find(filter).sort({ updatedAt: -1 }).skip(Number(skip)).limit(Math.min(Number(limit), 100)).lean(),
      Target.countDocuments(filter)
    ]);

    const reconciled = await Promise.all(
      items.map((item) => reconcileTargetAchieved(item))
    );

    return res.json({ success: true, data: reconciled, total });
  } catch (err) {
    return handleError(res, err, 'Error listing targets');
  }
};

exports.getTargetSummary = async (req, res) => {
  try {
    assertTargetPermission(req.user, 'view');
    const ownerId = req.query.ownerId || req.user._id;
    const appKey = req.query.appKey ? String(req.query.appKey).toUpperCase() : null;
    const moduleKey = req.query.moduleKey ? String(req.query.moduleKey).toLowerCase() : null;

    const assignmentRows = await TargetAssignment.find({
      organizationId: req.user.organizationId,
      userId: ownerId
    })
      .select('targetId')
      .lean();
    const assignedTargetIds = assignmentRows.map((r) => r.targetId);

    let targets = await Target.find({
      organizationId: req.user.organizationId,
      lifecycleStatus: { $in: ['active', 'locked'] },
      $or: [{ ownerId }, { _id: { $in: assignedTargetIds } }]
    })
      .sort({ periodEnd: 1 })
      .limit(20)
      .lean();

    if (appKey && moduleKey) {
      targets = targets.filter((t) =>
        (t.sourceModules || []).some((m) => m.appKey === appKey && m.moduleKey === moduleKey)
      );
    }

    return res.json({
      success: true,
      data: targets.map((t) => ({
        id: t._id,
        name: t.name,
        targetValue: t.targetValue,
        achievedValue: t.achievedValue,
        forecastValue: t.forecastValue,
        status: t.status,
        percent: t.targetValue > 0 ? Math.round((t.achievedValue / t.targetValue) * 100) : 0,
        periodEnd: t.periodEnd
      }))
    });
  } catch (err) {
    return handleError(res, err, 'Error loading target summary');
  }
};

exports.getTargetById = async (req, res) => {
  try {
    assertTargetPermission(req.user, 'view');
    let target = await Target.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    }).lean();
    if (!target) return res.status(404).json({ success: false, message: 'Target not found' });
    target = await reconcileTargetAchieved(target);
    return res.json({ success: true, data: target });
  } catch (err) {
    return handleError(res, err, 'Error loading target');
  }
};

exports.createTarget = async (req, res) => {
  try {
    assertTargetPermission(req.user, 'create');
    const payload = pickTargetPayload(req.body);
    if (!payload.name || !payload.targetTypeKey || payload.targetValue == null) {
      return res.status(400).json({ success: false, message: 'name, targetTypeKey, and targetValue are required' });
    }

    if (!payload.sourceModules?.length && req.body.autoSuggestModules !== false) {
      const types = await listTargetTypes(req.user.organizationId);
      const typeDef = types.find((t) => t.key === payload.targetTypeKey);
      payload.sourceModules = typeDef?.defaultSourceModules || [];
    }

    if (!payload.contributionRules?.length && payload.sourceModules?.length) {
      payload.contributionRules = payload.sourceModules.map((m, i) =>
        buildDefaultRule(m.appKey, m.moduleKey, i)
      );
    }

    const target = await Target.create({
      ...payload,
      organizationId: req.user.organizationId,
      lifecycleStatus: 'draft',
      createdBy: req.user._id,
      updatedBy: req.user._id,
      ownerId: payload.ownerId || req.user._id
    });

    return res.status(201).json({ success: true, data: target });
  } catch (err) {
    return handleError(res, err, 'Error creating target');
  }
};

exports.updateTarget = async (req, res) => {
  try {
    assertTargetPermission(req.user, 'edit');
    const target = await Target.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });
    if (!target) return res.status(404).json({ success: false, message: 'Target not found' });
    if (['locked', 'completed', 'closed'].includes(target.lifecycleStatus)) {
      return res.status(400).json({ success: false, message: 'Target is not editable in this lifecycle state' });
    }

    const payload = pickTargetPayload(req.body);
    Object.keys(payload).forEach((k) => {
      if (payload[k] !== undefined) target[k] = payload[k];
    });
    target.updatedBy = req.user._id;
    target.dependencyWarnings = await resolveDependencyWarnings(target);
    await target.save();

    return res.json({ success: true, data: target });
  } catch (err) {
    return handleError(res, err, 'Error updating target');
  }
};

exports.activateTarget = async (req, res) => {
  try {
    assertTargetPermission(req.user, 'activate');
    const target = await Target.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });
    if (!target) return res.status(404).json({ success: false, message: 'Target not found' });
    if (target.lifecycleStatus !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft targets can be activated' });
    }

    const conflicts = await detectConflicts(target.toObject(), req.user.organizationId, target._id);
    if (conflicts.length && !req.body.overrideConflicts) {
      return res.status(409).json({
        success: false,
        message: 'Overlapping targets detected',
        conflicts
      });
    }

    const assignees = req.body.assignees || [];
    await syncAssignmentsFromDistribution(target, assignees);
    target.lifecycleStatus = 'active';
    target.activatedAt = new Date();
    target.updatedBy = req.user._id;
    target.dependencyWarnings = await resolveDependencyWarnings(target);
    await target.save();

    await publishTargetVersion(target, 'activate', req.user._id);
    await recomputeTargetForecast(target);
    emitTargetActivated(target, req.user._id);

    return res.json({ success: true, data: target });
  } catch (err) {
    return handleError(res, err, 'Error activating target');
  }
};

exports.lockTarget = async (req, res) => {
  try {
    assertTargetPermission(req.user, 'edit');
    const target = await Target.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });
    if (!target) return res.status(404).json({ success: false, message: 'Target not found' });
    if (target.lifecycleStatus !== 'active') {
      return res.status(400).json({ success: false, message: 'Only active targets can be locked' });
    }
    target.lifecycleStatus = 'locked';
    target.lockedAt = new Date();
    await target.save();
    return res.json({ success: true, data: target });
  } catch (err) {
    return handleError(res, err, 'Error locking target');
  }
};

exports.completeTarget = async (req, res) => {
  try {
    assertTargetPermission(req.user, 'edit');
    const target = await Target.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });
    if (!target) return res.status(404).json({ success: false, message: 'Target not found' });
    target.lifecycleStatus = 'completed';
    target.completedAt = new Date();
    await target.save();
    return res.json({ success: true, data: target });
  } catch (err) {
    return handleError(res, err, 'Error completing target');
  }
};

exports.closeTarget = async (req, res) => {
  try {
    assertTargetPermission(req.user, 'edit');
    const target = await Target.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });
    if (!target) return res.status(404).json({ success: false, message: 'Target not found' });
    target.lifecycleStatus = 'closed';
    target.closedAt = new Date();
    await target.save();
    return res.json({ success: true, data: target });
  } catch (err) {
    return handleError(res, err, 'Error closing target');
  }
};

exports.getAssignments = async (req, res) => {
  try {
    assertTargetPermission(req.user, 'view');
    const target = await Target.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    }).select('_id').lean();
    if (!target) return res.status(404).json({ success: false, message: 'Target not found' });

    const items = await TargetAssignment.find({
      targetId: req.params.id,
      organizationId: req.user.organizationId
    })
      .populate('userId', 'firstName lastName email')
      .sort({ allocatedValue: -1 })
      .lean();

    return res.json({ success: true, data: items });
  } catch (err) {
    return handleError(res, err, 'Error loading assignments');
  }
};

exports.getContributions = async (req, res) => {
  try {
    assertTargetPermission(req.user, 'view');
    const { limit = 50, skip = 0 } = req.query;
    const items = await TargetContributionLedger.find({
      targetId: req.params.id,
      organizationId: req.user.organizationId
    })
      .sort({ occurredAt: -1 })
      .skip(Number(skip))
      .limit(Math.min(Number(limit), 200))
      .lean();
    return res.json({ success: true, data: items });
  } catch (err) {
    return handleError(res, err, 'Error loading contributions');
  }
};

exports.getForecast = async (req, res) => {
  try {
    assertTargetPermission(req.user, 'view');
    let target = await Target.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    }).lean();
    if (!target) return res.status(404).json({ success: false, message: 'Target not found' });

    if (['active', 'locked'].includes(target.lifecycleStatus)) {
      const refreshed = await refreshTargetAchievedFromLedger(target._id);
      target = refreshed?.toObject ? refreshed.toObject() : refreshed;
    }
    await recomputeTargetForecast(target._id);
    const latest = await Target.findById(target._id).lean();
    const breakdown = await getForecastBreakdown(target._id);

    return res.json({
      success: true,
      data: {
        forecastValue: latest?.forecastValue ?? 0,
        achievementProbability: latest?.achievementProbability ?? null,
        riskLevel: latest?.riskLevel ?? null,
        breakdown
      }
    });
  } catch (err) {
    return handleError(res, err, 'Error loading forecast');
  }
};

exports.checkConflicts = async (req, res) => {
  try {
    assertTargetPermission(req.user, 'view');
    const conflicts = await detectConflicts(
      req.body,
      req.user.organizationId,
      req.body.excludeTargetId
    );
    return res.json({ success: true, data: conflicts });
  } catch (err) {
    return handleError(res, err, 'Error checking conflicts');
  }
};

exports.listVersions = async (req, res) => {
  try {
    assertTargetPermission(req.user, 'view');
    const versions = await listTargetVersions(req.params.id);
    return res.json({ success: true, data: versions });
  } catch (err) {
    return handleError(res, err, 'Error loading versions');
  }
};

exports.redistributeTarget = async (req, res) => {
  try {
    assertTargetPermission(req.user, 'edit');
    const target = await Target.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });
    if (!target) return res.status(404).json({ success: false, message: 'Target not found' });
    if (!['active', 'locked'].includes(target.lifecycleStatus)) {
      return res.status(400).json({ success: false, message: 'Target must be active to redistribute' });
    }
    const version = await applyDistributionChange(target, req.body.assignees || [], req.user._id);
    return res.json({ success: true, data: { target, version } });
  } catch (err) {
    return handleError(res, err, 'Error redistributing target');
  }
};

exports.recalculateTarget = async (req, res) => {
  try {
    assertTargetPermission(req.user, 'edit');
    const target = await recalculateTargetFromLedger(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'Target not found' });
    return res.json({ success: true, data: target });
  } catch (err) {
    return handleError(res, err, 'Error recalculating target');
  }
};

exports.listTargetTypes = async (req, res) => {
  try {
    assertTargetPermission(req.user, 'view');
    const types = await listTargetTypes(req.user.organizationId);
    return res.json({ success: true, data: types });
  } catch (err) {
    return handleError(res, err, 'Error listing target types');
  }
};

exports.upsertTargetType = async (req, res) => {
  try {
    assertTargetPermission(req.user, 'manageTypes');
    const { key, name, metricKind, defaultSourceModules, description } = req.body;
    if (!key || !name) {
      return res.status(400).json({ success: false, message: 'key and name are required' });
    }
    const doc = await TargetTypeDefinition.findOneAndUpdate(
      { organizationId: req.user.organizationId, key: String(key).toLowerCase() },
      {
        organizationId: req.user.organizationId,
        key: String(key).toLowerCase(),
        name,
        metricKind,
        defaultSourceModules,
        description,
        isSystem: false,
        enabled: true
      },
      { upsert: true, new: true }
    );
    return res.json({ success: true, data: doc });
  } catch (err) {
    return handleError(res, err, 'Error saving target type');
  }
};

exports.getPlatformSettings = async (req, res) => {
  try {
    assertTargetPermission(req.user, 'manageOrgSettings');
    let settings = await TargetPlatformSettings.findOne({ organizationId: req.user.organizationId });
    if (!settings) {
      settings = await TargetPlatformSettings.create({ organizationId: req.user.organizationId });
    }
    return res.json({ success: true, data: settings });
  } catch (err) {
    return handleError(res, err, 'Error loading platform settings');
  }
};

exports.updatePlatformSettings = async (req, res) => {
  try {
    assertTargetPermission(req.user, 'manageOrgSettings');
    const settings = await TargetPlatformSettings.findOneAndUpdate(
      { organizationId: req.user.organizationId },
      { $set: req.body, organizationId: req.user.organizationId },
      { upsert: true, new: true }
    );
    return res.json({ success: true, data: settings });
  } catch (err) {
    return handleError(res, err, 'Error updating platform settings');
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    assertTargetPermission(req.user, 'view');
    const data = await getLeaderboard(req.user.organizationId, { limit: Number(req.query.limit) || 10 });
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'Error loading leaderboard');
  }
};

exports.seedTargetTypes = async (req, res) => {
  try {
    assertTargetPermission(req.user, 'manageTypes');
    await ensureDefaultTargetTypes(req.user.organizationId);
    const types = await listTargetTypes(req.user.organizationId);
    return res.json({ success: true, data: types });
  } catch (err) {
    return handleError(res, err, 'Error seeding target types');
  }
};

exports.getLifecycleOptions = async (req, res) => {
  return res.json({ success: true, data: TARGET_LIFECYCLE });
};
