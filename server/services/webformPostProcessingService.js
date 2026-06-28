'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const domainEvents = require('../constants/domainEvents');
const { appendRecordActivityLog } = require('../utils/recordActivityLogger');
const { emitRecordLifecycle } = require('./domainEventHelpers');
const { emit } = require('./domainEvents');
const { emitNotification } = require('./notificationEngine');

const ENTITY_TYPE_BY_MODULE = {
  people: 'people',
  organizations: 'organization',
  cases: 'cases',
  deals: 'deal'
};

const RELATED_TO_BY_MODULE = {
  people: 'contact',
  organizations: 'organization',
  deals: 'deal'
};

const SNAPSHOT_KEYS_BY_MODULE = {
  people: ['first_name', 'last_name', 'email', 'assignedTo'],
  organizations: ['name', 'assignedTo'],
  cases: ['title', 'assignedTo', 'status'],
  deals: ['name', 'assignedTo', 'stage']
};

function mapModuleEntityType(moduleKey) {
  return ENTITY_TYPE_BY_MODULE[String(moduleKey || '').toLowerCase()] || 'people';
}

function resolveRecordOwnerId(record, moduleKey) {
  if (!record) return null;
  const key = String(moduleKey || '').toLowerCase();
  if (key === 'people') return record.assignedTo || null;
  if (key === 'organizations') return record.assignedTo || null;
  if (key === 'cases') return record.assignedTo || null;
  if (key === 'deals') return record.assignedTo || null;
  return null;
}

function resolveTaskRelatedTo(moduleKey, recordId) {
  const type = RELATED_TO_BY_MODULE[String(moduleKey || '').toLowerCase()] || 'none';
  if (type === 'none' || !recordId) {
    return { type: 'none', id: null };
  }
  try {
    return { type, id: new mongoose.Types.ObjectId(recordId) };
  } catch {
    return { type: 'none', id: null };
  }
}

async function logSubmissionActivity({ webform, submission, crmOutcome, actorUserId, organizationId }) {
  if (!crmOutcome?.recordId || crmOutcome.action === 'skipped') return;

  const moduleKey = String(crmOutcome.moduleKey || webform.targetModuleKey || 'people').toLowerCase();
  await appendRecordActivityLog({
    organizationId,
    moduleKey,
    recordId: crmOutcome.recordId,
    authorId: actorUserId,
    action: 'webform_submission',
    message: `Webform "${webform.name}" submission received`,
    details: {
      webformId: webform._id,
      submissionId: submission._id,
      crmAction: crmOutcome.action
    }
  });
}

function emitCrmDomainEvent({ record, moduleKey, crmAction, organizationId, actorUserId, appKey }) {
  if (!record || crmAction !== 'created') return;

  const entityType = mapModuleEntityType(moduleKey);
  const snapshotKeys = SNAPSHOT_KEYS_BY_MODULE[String(moduleKey).toLowerCase()] || ['name'];
  const assignedTo = record.assignedTo || actorUserId;

  emitRecordLifecycle({
    entityType,
    entityId: record._id,
    previous: null,
    current: record,
    snapshotKeys,
    appKey,
    triggeredBy: actorUserId,
    organizationId,
    assignedTo
  });
}

function emitWebformSubmissionProcessed({
  webform,
  submission,
  crmOutcome,
  record,
  actorUserId,
  organizationId
}) {
  const moduleKey = String(crmOutcome?.moduleKey || webform.targetModuleKey || 'people').toLowerCase();
  const assignedTo =
    resolveRecordOwnerId(record, moduleKey)
    || webform.createdBy
    || actorUserId;

  emit({
    entityType: 'webform_submission',
    entityId: submission._id,
    eventType: 'webform.submission.processed',
    previousState: null,
    currentState: {
      webformId: webform.webformId,
      webformName: webform.name,
      submissionId: submission._id,
      status: submission.status,
      crmOutcome: submission.crmOutcome || null,
      dedupOutcome: submission.dedupOutcome || null,
      assignmentOutcome: submission.assignmentOutcome || null,
      targetModuleKey: moduleKey,
      crmRecordId: crmOutcome?.recordId || null,
      crmAction: crmOutcome?.action || null
    },
    appKey: webform.targetAppKey || 'SALES',
    triggeredBy: actorUserId,
    organizationId,
    assignedTo
  });
}

function collectNotifyRecipientUserIds(webform) {
  const userIds = new Set();
  if (webform.createdBy) {
    userIds.add(String(webform.createdBy));
  }
  if (Array.isArray(webform.notifyOnSubmit?.userIds)) {
    for (const id of webform.notifyOnSubmit.userIds) {
      if (id) userIds.add(String(id));
    }
  }
  return [...userIds];
}

async function notifySubmissionRecipients({ webform, submission, organizationId }) {
  if (webform?.notifyOnSubmit?.enabled === false) return;

  const recipientUserIds = collectNotifyRecipientUserIds(webform);
  if (!recipientUserIds.length) return;

  const appKey = String(webform.targetAppKey || 'SALES').toUpperCase();
  const title = `New submission: ${webform.name}`;
  const body = 'A webform submission was received and processed.';

  void emitNotification({
    eventType: domainEvents.WEBFORM_SUBMISSION,
    organizationId,
    sourceAppKey: appKey,
    title: title,
    body,
    entity: {
      type: 'WebformSubmission',
      id: submission._id,
      title: webform.name,
      notifyRecipientUserIds: recipientUserIds
    }
  }).catch((err) => {
    console.warn('[webformPostProcessing] notification failed:', err?.message || err);
  });
}

async function createSubmissionTask({
  webform,
  submission,
  crmOutcome,
  record,
  actorUserId,
  organizationId
}) {
  const taskConfig = webform?.taskOnSubmit;
  if (!taskConfig?.enabled) return;

  const title = String(taskConfig.title || '').trim();
  if (!title) return;

  const moduleKey = String(crmOutcome?.moduleKey || webform.targetModuleKey || 'people').toLowerCase();
  let assigneeId = null;
  const assigneeRule = taskConfig.assignee || 'record_owner';

  if (assigneeRule === 'webform_creator' && webform.createdBy) {
    assigneeId = webform.createdBy;
  } else if (assigneeRule === 'specific_user' && taskConfig.assigneeUserId) {
    assigneeId = taskConfig.assigneeUserId;
  } else {
    assigneeId = resolveRecordOwnerId(record, moduleKey) || webform.createdBy || actorUserId;
  }

  if (!assigneeId) return;

  let dueDate = null;
  if (typeof taskConfig.dueInDays === 'number' && taskConfig.dueInDays >= 0) {
    dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + taskConfig.dueInDays);
  }

  const relatedTo = crmOutcome?.recordId
    ? resolveTaskRelatedTo(moduleKey, crmOutcome.recordId)
    : { type: 'none', id: null };

  try {
    const { assignResolvedSource } = require('./sourceResolver');
    const taskPayload = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      title,
      description: String(taskConfig.description || '').trim() || undefined,
      dueDate,
      relatedTo,
      assignedTo: new mongoose.Types.ObjectId(assigneeId),
      assignedBy: actorUserId ? new mongoose.Types.ObjectId(actorUserId) : undefined,
      status: 'todo',
      priority: 'medium',
      createdBy: actorUserId ? new mongoose.Types.ObjectId(actorUserId) : undefined
    };
    assignResolvedSource(taskPayload, 'web_form');
    await Task.create(taskPayload);
  } catch (err) {
    console.warn('[webformPostProcessing] task creation failed:', err?.message || err);
  }
}

async function deliverSubmissionWebhook({ webform, submission, crmOutcome }) {
  const webhook = webform?.webhook;
  if (!webhook?.enabled || !webhook?.url) return;

  const payload = {
    event: 'webform.submission.processed',
    webformId: webform.webformId,
    webformName: webform.name,
    submissionId: submission._id,
    status: submission.status,
    crmOutcome,
    dedupOutcome: submission.dedupOutcome || null,
    assignmentOutcome: submission.assignmentOutcome || null,
    submittedAt: submission.createdAt
  };

  const body = JSON.stringify(payload);
  const headers = { 'Content-Type': 'application/json' };
  if (webhook.secret) {
    headers['X-LiteDesk-Signature'] = crypto
      .createHmac('sha256', String(webhook.secret))
      .update(body)
      .digest('hex');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    await fetch(String(webhook.url), {
      method: 'POST',
      headers,
      body,
      signal: controller.signal
    });
  } catch (err) {
    console.warn('[webformPostProcessing] webhook delivery failed:', err?.message || err);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Non-blocking post-processing after successful CRM ingestion.
 */
async function runWebformPostProcessing({
  webform,
  submission,
  crmOutcome,
  record,
  actorUserId,
  organizationId
}) {
  try {
    await logSubmissionActivity({ webform, submission, crmOutcome, actorUserId, organizationId });
  } catch (err) {
    console.warn('[webformPostProcessing] activity log failed:', err?.message || err);
  }

  try {
    emitCrmDomainEvent({
      record,
      moduleKey: crmOutcome.moduleKey,
      crmAction: crmOutcome.action,
      organizationId,
      actorUserId,
      appKey: webform.targetAppKey || 'SALES'
    });
  } catch (err) {
    console.warn('[webformPostProcessing] domain event failed:', err?.message || err);
  }

  try {
    emitWebformSubmissionProcessed({
      webform,
      submission,
      crmOutcome,
      record,
      actorUserId,
      organizationId
    });
  } catch (err) {
    console.warn('[webformPostProcessing] webform automation event failed:', err?.message || err);
  }

  void notifySubmissionRecipients({ webform, submission, organizationId });
  void createSubmissionTask({
    webform,
    submission,
    crmOutcome,
    record,
    actorUserId,
    organizationId
  });
  void deliverSubmissionWebhook({ webform, submission, crmOutcome });
}

module.exports = {
  runWebformPostProcessing,
  notifySubmissionRecipients,
  deliverSubmissionWebhook,
  createSubmissionTask,
  emitWebformSubmissionProcessed
};
