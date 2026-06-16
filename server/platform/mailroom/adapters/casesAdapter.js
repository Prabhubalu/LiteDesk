'use strict';

const mongoose = require('mongoose');
const Case = require('../../../models/Case');
const MailroomConversation = require('../../../models/MailroomConversation');
const {
  createCaseFromInboundEmail,
  appendInboundEmailActivity
} = require('../../../services/helpdeskChannelIngestionService');
const {
  createReopenedSlaState
} = require('../../../services/caseLifecycleService');
const { reopenCaseSla } = require('../../../services/sla/slaCaseBridgeService');
const caseExecutionService = require('../../../services/caseExecutionService');
const { getFromAddress } = require('../services/conversationPersistenceService');
const { normalizeDefaultsForCaseCreate } = require('../policies/strategies/classificationStrategies');

const MAILROOM_REOPEN_REASON = 'Reopened automatically from inbound email (Mailroom)';

function parsedEmailFromMessage(normalizedMessage) {
  return {
    fromAddress: getFromAddress(normalizedMessage),
    subject: normalizedMessage.subject || '',
    body: normalizedMessage.body || ''
  };
}

/**
 * Merge dedup + threading + case_link evaluation into an executable plan.
 */
function resolveCaseExecutionPlan(policyEvaluation = {}) {
  const dedup = policyEvaluation.dedup || {};
  const caseLink = policyEvaluation.caseLink || {};
  const threading = policyEvaluation.threading || {};

  let action = caseLink.action || 'create_case';
  let caseId = caseLink.caseId || null;
  let reason = caseLink.reason || 'case_link';
  const defaults = normalizeDefaultsForCaseCreate(caseLink.defaults || {});
  const trace = [...(caseLink.trace || [])];

  const threadedCaseId = threading.target?.caseId || null;
  const threadedConversationId = threading.target?.conversationId || null;

  if (threadedCaseId && (action === 'append' || action === 'reopen')) {
    caseId = threadedCaseId;
    trace.push(`threading target case: ${threadedCaseId}`);
  }

  if (dedup.isDuplicate) {
    trace.push(`dedup: ${dedup.behavior}`);
    if (dedup.behavior === 'flag_for_review') {
      return {
        action: 'flag_for_review',
        caseId: caseId || threadedCaseId,
        reason: 'dedup_flag_for_review',
        defaults,
        trace,
        dedupApplied: true
      };
    }
    if (dedup.behavior === 'append_to_existing_open_case') {
      action = 'append';
      caseId = caseId || threadedCaseId;
      reason = 'dedup_append';
    }
    if (dedup.behavior === 'create_child_case') {
      return {
        action: 'create_child_case',
        caseId: caseId || threadedCaseId || null,
        reason: 'dedup_create_child_case',
        defaults,
        trace,
        dedupApplied: true
      };
    }
    if (dedup.behavior === 'ignore') {
      return {
        action: 'no_op',
        caseId: null,
        reason: 'dedup_ignore',
        defaults,
        trace,
        dedupApplied: true
      };
    }
  }

  if (action === 'append' && !caseId && threadedConversationId) {
    trace.push(`resolve case from conversation ${threadedConversationId}`);
    return {
      action: 'append',
      caseId: null,
      conversationId: threadedConversationId,
      reason: 'threading_conversation',
      defaults,
      trace,
      resolveConversationCase: true
    };
  }

  return {
    action,
    caseId,
    reason,
    defaults,
    trace,
    dedupApplied: dedup.isDuplicate === true
  };
}

async function resolveCaseIdFromConversation(organizationId, conversationId) {
  if (!conversationId) return null;
  const conv = await MailroomConversation.findOne({
    _id: conversationId,
    organizationId
  })
    .select('primaryCaseId')
    .lean();
  return conv?.primaryCaseId || null;
}

async function reopenCaseForInboundEmail({
  organizationId,
  caseRecord,
  reopenReason = MAILROOM_REOPEN_REASON
}) {
  if (!caseRecord) return null;
  if (caseRecord.status !== 'Resolved' && caseRecord.status !== 'Closed') {
    return caseRecord;
  }

  const { previousCycle, nextCycle } = createReopenedSlaState(
    caseRecord.currentSlaCycle?.toObject?.() || caseRecord.currentSlaCycle,
    new Date()
  );

  caseRecord.slaCycles = Array.isArray(caseRecord.slaCycles) ? caseRecord.slaCycles : [];
  caseRecord.slaCycles.push(previousCycle);
  caseRecord.currentSlaCycle = await reopenCaseSla({
    organizationId,
    caseRecord,
    previousCycle,
    nextCycle
  });
  caseRecord.status = 'In Progress';
  caseRecord.reopenReason = reopenReason;
  caseRecord.reopenCount = (Number(caseRecord.reopenCount) || 0) + 1;

  caseRecord.activities.push({
    activityType: 'case_reopened',
    message: 'Case reopened from inbound email (Mailroom)',
    internal: true,
    metadata: {
      previousCycleNo: previousCycle.cycleNo,
      newCycleNo: caseRecord.currentSlaCycle.cycleNo,
      reopenReason,
      source: 'mailroom'
    },
    actorId: null,
    actorName: 'Mailroom',
    createdAt: new Date()
  });

  await caseRecord.save();
  await caseExecutionService.onCaseReopened({
    caseRecord,
    actorId: null,
    previousCycleNo: previousCycle.cycleNo,
    newCycleNo: caseRecord.currentSlaCycle.cycleNo
  });

  return caseRecord;
}

async function flagCaseForReview(caseRecord, parsedEmail) {
  caseRecord.activities = Array.isArray(caseRecord.activities) ? caseRecord.activities : [];
  caseRecord.activities.push({
    activityType: 'email_duplicate_flagged',
    message: 'Potential duplicate inbound email flagged for review (Mailroom)',
    internal: true,
    metadata: {
      fromAddress: parsedEmail.fromAddress,
      subject: parsedEmail.subject,
      source: 'mailroom'
    },
    actorId: null,
    actorName: 'Mailroom',
    createdAt: new Date()
  });
  await caseRecord.save();
  return caseRecord;
}

async function loadCase(organizationId, caseId) {
  if (!caseId || !mongoose.Types.ObjectId.isValid(String(caseId))) return null;
  return Case.findOne({
    _id: caseId,
    organizationId,
    deletedAt: null
  });
}

/**
 * Execute Mailroom case_link (+ dedup) policy against Cases APIs.
 */
async function executeMailroomCaseLink({
  organizationId,
  normalizedMessage,
  policyEvaluation,
  communicationId = null
}) {
  const plan = resolveCaseExecutionPlan(policyEvaluation);
  const parsedEmail = parsedEmailFromMessage(normalizedMessage);

  if (plan.action === 'no_op') {
    return {
      executed: false,
      action: plan.action,
      reason: plan.reason,
      plan,
      caseRecord: null,
      caseId: null
    };
  }

  let caseId = plan.caseId;
  if (plan.resolveConversationCase && plan.conversationId) {
    caseId = await resolveCaseIdFromConversation(organizationId, plan.conversationId);
  }

  let caseRecord = caseId ? await loadCase(organizationId, caseId) : null;
  let action = plan.action;

  if (plan.action === 'create_child_case') {
    caseRecord = await createCaseFromInboundEmail({
      organizationId,
      subject: parsedEmail.subject,
      body: parsedEmail.body,
      fromAddress: parsedEmail.fromAddress,
      communicationId,
      parentCaseId: caseId || null,
      defaults: plan.defaults
    });
    action = 'created_child_case';
  } else if (plan.action === 'create_case' || (!caseRecord && plan.action !== 'flag_for_review')) {
    caseRecord = await createCaseFromInboundEmail({
      organizationId,
      subject: parsedEmail.subject,
      body: parsedEmail.body,
      fromAddress: parsedEmail.fromAddress,
      communicationId,
      defaults: plan.defaults
    });
    action = 'created_case';
  } else if (plan.action === 'reopen') {
    caseRecord = await reopenCaseForInboundEmail({ organizationId, caseRecord });
    await appendInboundEmailActivity({
      caseRecord,
      communicationId,
      fromAddress: parsedEmail.fromAddress,
      subject: parsedEmail.subject,
      body: parsedEmail.body
    });
    action = 'reopened_and_appended';
  } else if (plan.action === 'flag_for_review') {
    if (!caseRecord) {
      caseRecord = await createCaseFromInboundEmail({
        organizationId,
        subject: parsedEmail.subject,
        body: parsedEmail.body,
        fromAddress: parsedEmail.fromAddress,
        communicationId,
        defaults: plan.defaults
      });
      action = 'created_case_flagged';
    } else {
      await flagCaseForReview(caseRecord, parsedEmail);
      await appendInboundEmailActivity({
        caseRecord,
        communicationId,
        fromAddress: parsedEmail.fromAddress,
        subject: parsedEmail.subject,
        body: parsedEmail.body
      });
      action = 'flagged_existing_case';
    }
  } else {
    await appendInboundEmailActivity({
      caseRecord,
      communicationId,
      fromAddress: parsedEmail.fromAddress,
      subject: parsedEmail.subject,
      body: parsedEmail.body
    });
    action = 'appended_to_existing_case';
  }

  return {
    executed: true,
    action,
    reason: plan.reason,
    plan,
    caseRecord,
    caseId: caseRecord?._id || null
  };
}

module.exports = {
  MAILROOM_REOPEN_REASON,
  resolveCaseExecutionPlan,
  executeMailroomCaseLink,
  reopenCaseForInboundEmail
};
