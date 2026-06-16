const mongoose = require('mongoose');
const AssignmentRuleSet = require('../models/AssignmentRuleSet');
const AssignmentExecutionLog = require('../models/AssignmentExecutionLog');
const { simulateAssignment } = require('../services/assignmentRulesEngine');
const {
  ASSIGNMENT_TRIGGER_TYPES,
  ASSIGNMENT_DISTRIBUTION_MODES
} = require('../constants/assignmentRules');

function sanitizeConditions(raw) {
  const combinator = raw?.combinator === 'any' ? 'any' : 'all';
  const clausesIn = Array.isArray(raw?.clauses) ? raw.clauses : [];
  const clauses = clausesIn
    .map((c) => {
      const field = String(c.field || '').trim();
      const operator = String(c.operator || 'equals').trim();
      const value = operator === 'exists' ? null : c.value;
      return { field, operator, value };
    })
    .filter((c) => c.field.length > 0);
  return { combinator, clauses };
}

function sanitizeTriggerConfig(triggerType, raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const recheck = c.recheckConditionsAtExecution !== false;
  const evaluateScope = c.evaluateScope !== undefined ? c.evaluateScope : null;

  if (triggerType === 'delayed') {
    const dm = Number(c.delayMinutes);
    const delayMinutes = Number.isFinite(dm) && dm >= 1 ? Math.floor(dm) : 5;
    return {
      delayMinutes,
      recheckConditionsAtExecution: recheck,
      evaluateScope
    };
  }

  if (triggerType === 'scheduled') {
    const scheduleType = ['one_time', 'recurring'].includes(c.scheduleType) ? c.scheduleType : 'recurring';
    const frequency = ['daily', 'weekly', 'custom'].includes(c.frequency) ? c.frequency : 'daily';
    const scheduleTime = typeof c.scheduleTime === 'string' && /^\d{1,2}:\d{2}$/.test(c.scheduleTime.trim())
      ? c.scheduleTime.trim()
      : '10:00';
    const scheduleDayOfWeek = Number.isFinite(Number(c.scheduleDayOfWeek))
      ? Math.min(6, Math.max(0, Math.floor(Number(c.scheduleDayOfWeek))))
      : 1;
    let everyMinutes = null;
    if (frequency === 'custom') {
      const em = Number(c.everyMinutes);
      everyMinutes = Number.isFinite(em) && em >= 1 ? Math.floor(em) : 60;
    }
    let runAt = null;
    if (c.runAt) {
      const parsed = new Date(c.runAt);
      if (!Number.isNaN(parsed.getTime())) runAt = parsed;
    }
    if (scheduleType === 'one_time' && !runAt) {
      throw new Error(`Rule ${index + 1}: run date and time is required for a one-time schedule`);
    }
    const [hourPart, minutePart] = scheduleTime.split(':');
    const cron = frequency === 'custom'
      ? `*/${everyMinutes || 60} * * * *`
      : `${minutePart || '0'} ${hourPart || '10'} * * ${frequency === 'weekly' ? scheduleDayOfWeek : '*'}`;
    return {
      delayMinutes: null,
      scheduleType,
      frequency,
      cron,
      runAt,
      everyMinutes,
      scheduleTime: frequency === 'daily' || frequency === 'weekly' ? scheduleTime : null,
      scheduleDayOfWeek: frequency === 'weekly' ? scheduleDayOfWeek : null,
      recheckConditionsAtExecution: recheck,
      evaluateScope
    };
  }

  return {
    delayMinutes: null,
    recheckConditionsAtExecution: recheck,
    evaluateScope
  };
}

function sanitizeCustomUserIds(metadata) {
  const ids = Array.isArray(metadata?.customUserIds) ? metadata.customUserIds : [];
  return ids.filter((id) => mongoose.Types.ObjectId.isValid(id)).map(String);
}

function sanitizeEnabledMemberIds(metadata) {
  const ids = Array.isArray(metadata?.enabledMemberIds) ? metadata.enabledMemberIds : null;
  if (!ids) return null;
  return ids.filter((id) => mongoose.Types.ObjectId.isValid(id)).map(String);
}

function sanitizeRule(rule, index) {
  const metadata = rule.metadata && typeof rule.metadata === 'object' ? { ...rule.metadata } : {};
  const customUserIds = sanitizeCustomUserIds(metadata);
  const assignTargetType =
    metadata.assignTargetType === 'custom' || customUserIds.length > 0 ? 'custom' : 'group';
  metadata.assignTargetType = assignTargetType;
  metadata.customUserIds = assignTargetType === 'custom' ? customUserIds : [];

  if (assignTargetType === 'group') {
    const enabledMemberIds = sanitizeEnabledMemberIds(metadata);
    if (Array.isArray(metadata?.enabledMemberIds) && (!enabledMemberIds || enabledMemberIds.length === 0)) {
      throw new Error(`Rule ${index + 1}: at least one group member must be enabled`);
    }
    if (enabledMemberIds) metadata.enabledMemberIds = enabledMemberIds;
    else delete metadata.enabledMemberIds;
  } else {
    delete metadata.enabledMemberIds;
  }

  const primaryGroupId = rule.primaryGroupId || rule.groupId;
  if (assignTargetType === 'custom') {
    if (customUserIds.length === 0) {
      throw new Error(`Rule ${index + 1}: at least one user is required for custom assignment`);
    }
  } else if (!primaryGroupId || !mongoose.Types.ObjectId.isValid(primaryGroupId)) {
    throw new Error(`Rule ${index + 1}: primaryGroupId is required`);
  }

  if (
    rule.distribution?.mode &&
    !ASSIGNMENT_DISTRIBUTION_MODES.includes(rule.distribution.mode)
  ) {
    throw new Error(`Rule ${index + 1}: invalid distribution mode "${rule.distribution.mode}"`);
  }

  const triggerType = rule.triggerType || 'immediate';
  if (!ASSIGNMENT_TRIGGER_TYPES.includes(triggerType)) {
    throw new Error(`Rule ${index + 1}: invalid trigger type "${rule.triggerType}"`);
  }

  const fallbackGroupIds = Array.isArray(rule.fallbackGroupIds)
    ? rule.fallbackGroupIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
    : [];

  return {
    ruleId: String(rule.ruleId || `rule_${Date.now()}_${index + 1}`),
    name: String(rule.name || `Rule ${index + 1}`).trim(),
    enabled: rule.enabled !== false,
    order: Number.isFinite(Number(rule.order)) ? Number(rule.order) : index,
    triggerType,
    triggerConfig: sanitizeTriggerConfig(triggerType, rule.triggerConfig),
    conditions: sanitizeConditions(rule.conditions),
    primaryGroupId: assignTargetType === 'group' ? primaryGroupId : undefined,
    distribution: rule.distribution && typeof rule.distribution === 'object' ? rule.distribution : { mode: 'queue' },
    fallbackGroupIds,
    escalation: rule.escalation && typeof rule.escalation === 'object' ? rule.escalation : {},
    reassignment: rule.reassignment && typeof rule.reassignment === 'object' ? rule.reassignment : {},
    metadata
  };
}

async function getAssignmentRuleSet(req, res) {
  try {
    const appKey = String(req.query.appKey || 'HELPDESK').toUpperCase();
    const moduleKey = String(req.query.moduleKey || 'cases').toLowerCase();

    let row = await AssignmentRuleSet.findOne({
      organizationId: req.user.organizationId,
      appKey,
      moduleKey
    }).lean();

    if (!row) {
      row = {
        appKey,
        moduleKey,
        enabled: true,
        simulationOnly: true,
        version: 1,
        applyStrategy: 'new_records_only',
        rules: []
      };
    }

    return res.json({ success: true, data: row });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to load assignment rules',
      error: error.message
    });
  }
}

async function upsertAssignmentRuleSet(req, res) {
  try {
    const appKey = String(req.body?.appKey || 'HELPDESK').toUpperCase();
    const moduleKey = String(req.body?.moduleKey || 'cases').toLowerCase();
    const rulesInput = Array.isArray(req.body?.rules) ? req.body.rules : [];

    const rules = rulesInput.map((rule, index) => sanitizeRule(rule, index));

    const update = {
      appKey,
      moduleKey,
      enabled: req.body?.enabled !== false,
      simulationOnly: req.body?.simulationOnly !== false,
      applyStrategy: req.body?.applyStrategy || 'new_records_only',
      rules,
      updatedBy: req.user._id
    };

    const row = await AssignmentRuleSet.findOneAndUpdate(
      {
        organizationId: req.user.organizationId,
        appKey,
        moduleKey
      },
      {
        $set: update,
        $inc: { version: 1 },
        $setOnInsert: { organizationId: req.user.organizationId }
      },
      { new: true, upsert: true }
    ).lean();

    return res.json({ success: true, data: row });
  } catch (error) {
    const body = {
      success: false,
      message: 'Failed to save assignment rules',
      error: error.message
    };
    if (error.name === 'ValidationError' && error.errors) {
      body.details = Object.values(error.errors).map((e) => e.message);
    }
    return res.status(400).json(body);
  }
}

async function simulateAssignmentRules(req, res) {
  try {
    const appKey = String(req.body?.appKey || 'HELPDESK').toUpperCase();
    const moduleKey = String(req.body?.moduleKey || 'cases').toLowerCase();
    const record = req.body?.record && typeof req.body.record === 'object' ? req.body.record : {};
    const context = req.body?.context && typeof req.body.context === 'object' ? req.body.context : {};

    let rules = Array.isArray(req.body?.rules) ? req.body.rules : null;
    if (!rules) {
      const ruleSet = await AssignmentRuleSet.findOne({
        organizationId: req.user.organizationId,
        appKey,
        moduleKey
      }).lean();
      rules = ruleSet?.rules || [];
    }

    const normalizedRules = rules.map((rule, index) => sanitizeRule(rule, index));
    const simulation = await simulateAssignment({
      organizationId: req.user.organizationId,
      appKey,
      moduleKey,
      rules: normalizedRules,
      record,
      context
    });

    await AssignmentExecutionLog.create({
      organizationId: req.user.organizationId,
      appKey,
      moduleKey,
      recordId: String(record._id || record.id || `simulation-${Date.now()}`),
      executionId: `sim_${Date.now()}_${Math.round(Math.random() * 100000)}`,
      triggerSource: 'simulation',
      ruleId: simulation.ruleId,
      previousOwnerId: mongoose.Types.ObjectId.isValid(context.previousOwnerId)
        ? context.previousOwnerId
        : null,
      newOwnerId: mongoose.Types.ObjectId.isValid(simulation.outcome.assignedUserId)
        ? simulation.outcome.assignedUserId
        : null,
      assignedGroupId: mongoose.Types.ObjectId.isValid(simulation.outcome.assignedGroupId)
        ? simulation.outcome.assignedGroupId
        : null,
      status: 'simulated',
      idempotencyKey: req.body?.idempotencyKey || null,
      isManual: true,
      details: {
        recordSnapshot: record,
        context,
        trace: simulation.trace,
        outcome: simulation.outcome
      }
    });

    return res.json({ success: true, data: simulation });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to simulate assignment rules',
      error: error.message
    });
  }
}

module.exports = {
  getAssignmentRuleSet,
  upsertAssignmentRuleSet,
  simulateAssignmentRules
};
