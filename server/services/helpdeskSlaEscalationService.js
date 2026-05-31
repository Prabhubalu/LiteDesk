'use strict';

const notificationDomainEvents = require('../constants/domainEvents');
const { emitNotification } = require('./notificationEngine');
const { loadHelpdeskSlaConfig } = require('./helpdeskSlaService');
const { runImmediateAssignmentForCase } = require('./assignmentExecutionService');

function toIdString(value) {
  if (value == null) return null;
  return value.toString ? value.toString() : String(value);
}

async function emitSlaEscalationNotification(caseRecord, rule, metric, elapsedPercent) {
  const eventType = rule.actionType === 'NOTIFY_LEADERSHIP'
    ? notificationDomainEvents.CASE_SLA_LEADERSHIP_ESCALATION
    : notificationDomainEvents.CASE_SLA_ESCALATION;

  await emitNotification({
    eventType,
    entity: {
      type: 'Case',
      id: toIdString(caseRecord?._id),
      title: caseRecord?.title || '',
      status: caseRecord?.status || '',
      priority: caseRecord?.priority || '',
      slaMetric: metric,
      elapsedPercent,
      ruleKey: rule.key,
      ruleName: rule.name,
      actionType: rule.actionType
    },
    organizationId: caseRecord?.organizationId || null,
    triggeredBy: null,
    sourceAppKey: 'HELPDESK'
  });
}

async function executeEscalationAction(caseRecord, rule, metric, elapsedPercent) {
  switch (rule.actionType) {
    case 'NOTIFY_OWNER':
    case 'NOTIFY_LEADERSHIP':
      await emitSlaEscalationNotification(caseRecord, rule, metric, elapsedPercent);
      return { ok: true, action: rule.actionType };

    case 'REASSIGN_OWNER': {
      const assignmentResult = await runImmediateAssignmentForCase({
        caseRecord,
        actorId: null,
        triggerSource: 'sla_escalation',
        changedFields: ['sla_escalation']
      });
      await emitSlaEscalationNotification(caseRecord, rule, metric, elapsedPercent);
      return {
        ok: true,
        action: rule.actionType,
        ownerChanged: Boolean(assignmentResult?.ownerChanged)
      };
    }

    default:
      return { ok: false, error: `Unknown actionType: ${rule.actionType}` };
  }
}

/**
 * Run configured escalation rules for a metric when elapsed percent crosses triggerPercent.
 * @returns {Promise<{ executed: number, ruleKeys: string[] }>}
 */
async function processEscalationRules({
  caseRecord,
  metric,
  elapsedPercent,
  alerts,
  organizationId,
  rulesCache
}) {
  const orgKey = toIdString(organizationId);
  if (!rulesCache.has(orgKey)) {
    const config = await loadHelpdeskSlaConfig(organizationId);
    const rules = Array.isArray(config.escalationRules) ? config.escalationRules : [];
    rulesCache.set(orgKey, rules.slice().sort((a, b) => Number(a.triggerPercent) - Number(b.triggerPercent)));
  }

  const rules = rulesCache.get(orgKey) || [];
  const executedKeys = [];
  let executed = 0;

  for (const rule of rules) {
    if (!rule?.key || !rule.actionType) continue;
    const triggerPercent = Number(rule.triggerPercent);
    if (!Number.isFinite(triggerPercent) || elapsedPercent < triggerPercent) continue;

    const sentKey = `${metric}:${rule.key}`;
    if (alerts.escalationsSent[sentKey]) continue;

    try {
      const result = await executeEscalationAction(caseRecord, rule, metric, elapsedPercent);
      if (result.ok) {
        alerts.escalationsSent[sentKey] = new Date();
        executedKeys.push(rule.key);
        executed += 1;
      }
    } catch (error) {
      console.error('[helpdeskSlaEscalationService] rule failed:', rule.key, error.message);
    }
  }

  return { executed, ruleKeys: executedKeys };
}

module.exports = {
  processEscalationRules
};
