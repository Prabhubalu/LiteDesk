'use strict';

const Case = require('../../models/Case');
const TenantAppConfiguration = require('../../models/TenantAppConfiguration');
const notificationDomainEvents = require('../../constants/domainEvents');
const { emitNotification } = require('../notificationEngine');

const MILESTONE_TO_METRIC = {
  first_response: 'response',
  resolution: 'resolution'
};

const MILESTONE_TO_WARNING_EVENT = {
  first_response: notificationDomainEvents.CASE_SLA_WARNING,
  resolution: notificationDomainEvents.CASE_SLA_WARNING
};

const MILESTONE_TO_BREACH_EVENT = {
  first_response: notificationDomainEvents.CASE_SLA_BREACHED,
  resolution: notificationDomainEvents.CASE_SLA_BREACHED
};

function toIdString(value) {
  if (value == null) return null;
  return value.toString ? value.toString() : String(value);
}

async function getOrganizationNotificationPrefs(organizationId, cache) {
  const key = toIdString(organizationId);
  if (cache.has(key)) return cache.get(key);

  const appConfig = await TenantAppConfiguration.findOne({
    organizationId,
    appKey: 'HELPDESK'
  })
    .select('settings.helpdeskExecution.notifications settings.notifications')
    .lean();

  const notifications = appConfig?.settings?.helpdeskExecution?.notifications ||
    appConfig?.settings?.notifications ||
    {};

  const prefs = {
    notifyOnSlaWarning: notifications.notifyOnSlaWarning !== false,
    notifyOnSlaBreach: notifications.notifyOnSlaBreach !== false
  };
  cache.set(key, prefs);
  return prefs;
}

async function emitSlaInstanceNotification({
  caseRecord,
  instance,
  type,
  elapsedPercent
}) {
  const metric = MILESTONE_TO_METRIC[instance.milestoneKey] || instance.milestoneKey;
  const eventType = type === 'breach'
    ? (MILESTONE_TO_BREACH_EVENT[instance.milestoneKey] || notificationDomainEvents.CASE_SLA_BREACHED)
    : (MILESTONE_TO_WARNING_EVENT[instance.milestoneKey] || notificationDomainEvents.CASE_SLA_WARNING);

  await emitNotification({
    eventType,
    entity: {
      type: 'Case',
      id: toIdString(caseRecord?._id || instance.recordId),
      title: caseRecord?.title || '',
      status: caseRecord?.status || '',
      priority: caseRecord?.priority || '',
      slaMetric: metric,
      elapsedPercent,
      policyKey: instance.policyKey,
      milestoneKey: instance.milestoneKey
    },
    organizationId: caseRecord?.organizationId || instance.organizationId,
    triggeredBy: null,
    sourceAppKey: 'HELPDESK'
  });
}

async function processInstanceEscalation({ instance, caseRecord, policy }) {
  if (!policy?.escalations?.enabled) return false;
  const steps = Array.isArray(policy.escalations.steps) ? policy.escalations.steps : [];
  if (steps.length === 0) return false;

  const state = instance.escalationState || {};
  const stepIndex = Number(state.stepIndex) || 0;
  if (stepIndex >= steps.length) return false;

  const cooldownMinutes = Number(policy.escalations.cooldownMinutes) || 15;
  const lastAt = state.lastFiredAt ? new Date(state.lastFiredAt) : null;
  if (lastAt && Date.now() - lastAt.getTime() < cooldownMinutes * 60000) {
    return false;
  }

  await emitNotification({
    eventType: notificationDomainEvents.CASE_SLA_ESCALATION,
    entity: {
      type: 'Case',
      id: toIdString(caseRecord?._id || instance.recordId),
      title: caseRecord?.title || '',
      status: caseRecord?.status || '',
      priority: caseRecord?.priority || '',
      policyKey: instance.policyKey,
      escalationStep: steps[stepIndex]
    },
    organizationId: caseRecord?.organizationId || instance.organizationId,
    triggeredBy: null,
    sourceAppKey: 'HELPDESK'
  });

  return { stepIndex: stepIndex + 1, lastFiredAt: new Date() };
}

async function loadCaseForInstance(instance) {
  if (instance.moduleKey !== 'cases') return null;
  return Case.findOne({
    _id: instance.recordId,
    organizationId: instance.organizationId,
    deletedAt: null
  })
    .select('_id organizationId title status priority assignedTo')
    .lean();
}

module.exports = {
  getOrganizationNotificationPrefs,
  emitSlaInstanceNotification,
  processInstanceEscalation,
  loadCaseForInstance
};
