const { emit: emitDomainEvent } = require('./domainEvents');
const { emitNotification } = require('./notificationEngine');
const notificationDomainEvents = require('../constants/domainEvents');
const {
  runImmediateAssignmentForCase,
  registerManualOwnerOverride
} = require('./assignmentExecutionService');
const { enqueueAssignmentJobsForCase } = require('./assignmentSchedulingService');

function toIdString(value) {
  if (value == null) return null;
  return value.toString ? value.toString() : String(value);
}

function buildBaseEventPayload(caseRecord, actorId, eventType) {
  return {
    entityType: 'case',
    entityId: toIdString(caseRecord?._id),
    eventType,
    appKey: 'HELPDESK',
    organizationId: caseRecord?.organizationId || null,
    triggeredBy: actorId || null,
    assignedTo: caseRecord?.assignedTo || null
  };
}

function emitCaseDomainEvent(caseRecord, actorId, eventType, previousState, currentState) {
  emitDomainEvent({
    ...buildBaseEventPayload(caseRecord, actorId, eventType),
    previousState: previousState || null,
    currentState: currentState || null
  });
}

async function emitCaseNotification(caseRecord, actorId, eventType, entityOverrides = {}) {
  try {
    await emitNotification({
      eventType,
      entity: {
        type: 'Case',
        id: toIdString(caseRecord?._id),
        title: caseRecord?.title || '',
        status: caseRecord?.status || '',
        priority: caseRecord?.priority || '',
        ...entityOverrides
      },
      organizationId: caseRecord?.organizationId || null,
      triggeredBy: actorId || null,
      sourceAppKey: 'HELPDESK'
    });
  } catch (error) {
    console.error('[caseExecutionService] notification emit failed:', error.message);
  }
}

async function onCaseCreated({ caseRecord, actorId }) {
  try {
    const assignmentResult = await runImmediateAssignmentForCase({
      caseRecord,
      actorId,
      triggerSource: 'immediate',
      changedFields: []
    });

    emitCaseDomainEvent(
      caseRecord,
      actorId,
      'case.created',
      null,
      {
        status: caseRecord?.status || null,
        priority: caseRecord?.priority || null,
        assignedTo: toIdString(caseRecord?.assignedTo)
      }
    );
    await emitCaseNotification(caseRecord, actorId, notificationDomainEvents.CASE_CREATED);

    if (assignmentResult?.ownerChanged) {
      emitCaseDomainEvent(
        caseRecord,
        actorId,
        'case.assigned',
        { assignedTo: assignmentResult.previousOwnerId },
        {
          assignedTo: assignmentResult.newOwnerId,
          assignedGroupId: assignmentResult.assignedGroupId,
          ruleId: assignmentResult.ruleId
        }
      );
      await emitCaseNotification(caseRecord, actorId, notificationDomainEvents.CASE_ASSIGNED, {
        previousOwnerId: assignmentResult.previousOwnerId
      });

      if (assignmentResult?.escalated) {
        emitCaseDomainEvent(
          caseRecord,
          actorId,
          'case.escalated',
          { assignedTo: assignmentResult.previousOwnerId },
          {
            assignedTo: assignmentResult.newOwnerId,
            assignedGroupId: assignmentResult.assignedGroupId,
            ruleId: assignmentResult.ruleId
          }
        );
        await emitCaseNotification(caseRecord, actorId, notificationDomainEvents.CASE_ESCALATED, {
          previousOwnerId: assignmentResult.previousOwnerId,
          assignedGroupId: assignmentResult.assignedGroupId
        });
      }
    }

    await enqueueAssignmentJobsForCase({
      caseRecord,
      actorId,
      changedFields: []
    });
  } catch (error) {
    console.error('[caseExecutionService] onCaseCreated failed:', error.message);
  }
}

async function onCaseUpdated({ caseRecord, actorId, previousState = {}, changedFields = [] }) {
  try {
    const manuallyChangedOwner = changedFields.includes('assignedTo');
    if (manuallyChangedOwner) {
      await registerManualOwnerOverride({
        caseRecord,
        actorId,
        previousOwnerId: toIdString(previousState.assignedTo)
      });
    }

    const assignmentResult = manuallyChangedOwner
      ? { ownerChanged: false, previousOwnerId: toIdString(previousState.assignedTo) }
      : await runImmediateAssignmentForCase({
          caseRecord,
          actorId,
          triggerSource: 'immediate',
          changedFields
        });

    const ownerChanged =
      toIdString(previousState.assignedTo) !== toIdString(caseRecord?.assignedTo) ||
      Boolean(assignmentResult?.ownerChanged);

    emitCaseDomainEvent(
      caseRecord,
      actorId,
      'case.updated',
      previousState,
      {
        status: caseRecord?.status || null,
        priority: caseRecord?.priority || null,
        assignedTo: toIdString(caseRecord?.assignedTo),
        changedFields
      }
    );

    if (ownerChanged) {
      await emitCaseNotification(caseRecord, actorId, notificationDomainEvents.CASE_ASSIGNED, {
        previousOwnerId: assignmentResult?.previousOwnerId || toIdString(previousState.assignedTo)
      });
      if (assignmentResult?.escalated) {
        emitCaseDomainEvent(
          caseRecord,
          actorId,
          'case.escalated',
          { assignedTo: assignmentResult.previousOwnerId || toIdString(previousState.assignedTo) },
          {
            assignedTo: assignmentResult.newOwnerId,
            assignedGroupId: assignmentResult.assignedGroupId,
            ruleId: assignmentResult.ruleId
          }
        );
        await emitCaseNotification(caseRecord, actorId, notificationDomainEvents.CASE_ESCALATED, {
          previousOwnerId: assignmentResult.previousOwnerId || toIdString(previousState.assignedTo),
          assignedGroupId: assignmentResult.assignedGroupId
        });
      }
    }

    await enqueueAssignmentJobsForCase({
      caseRecord,
      actorId,
      changedFields
    });
  } catch (error) {
    console.error('[caseExecutionService] onCaseUpdated failed:', error.message);
  }
}

async function onCaseStatusChanged({ caseRecord, actorId, fromStatus, toStatus }) {
  try {
    const assignmentResult = await runImmediateAssignmentForCase({
      caseRecord,
      actorId,
      triggerSource: 'immediate',
      changedFields: ['status']
    });

    emitCaseDomainEvent(
      caseRecord,
      actorId,
      'case.status.changed',
      { status: fromStatus },
      { status: toStatus }
    );
    await emitCaseNotification(caseRecord, actorId, notificationDomainEvents.CASE_STATUS_CHANGED, {
      fromStatus,
      toStatus
    });

    if (assignmentResult?.ownerChanged) {
      await emitCaseNotification(caseRecord, actorId, notificationDomainEvents.CASE_ASSIGNED, {
        previousOwnerId: assignmentResult.previousOwnerId
      });
      if (assignmentResult?.escalated) {
        emitCaseDomainEvent(
          caseRecord,
          actorId,
          'case.escalated',
          { assignedTo: assignmentResult.previousOwnerId },
          {
            assignedTo: assignmentResult.newOwnerId,
            assignedGroupId: assignmentResult.assignedGroupId,
            ruleId: assignmentResult.ruleId
          }
        );
        await emitCaseNotification(caseRecord, actorId, notificationDomainEvents.CASE_ESCALATED, {
          previousOwnerId: assignmentResult.previousOwnerId,
          assignedGroupId: assignmentResult.assignedGroupId
        });
      }
    }

    await enqueueAssignmentJobsForCase({
      caseRecord,
      actorId,
      changedFields: ['status']
    });

    const { notifyPortalCaseStatusUpdate } = require('./portalCaseNotificationService');
    await notifyPortalCaseStatusUpdate(caseRecord, { actorId, toStatus });
  } catch (error) {
    console.error('[caseExecutionService] onCaseStatusChanged failed:', error.message);
  }
}

async function onCaseReopened({ caseRecord, actorId, previousCycleNo, newCycleNo }) {
  try {
    emitCaseDomainEvent(
      caseRecord,
      actorId,
      'case.reopened',
      { status: 'ResolvedOrClosed' },
      { status: caseRecord?.status || 'In Progress', previousCycleNo, newCycleNo }
    );
    await emitCaseNotification(caseRecord, actorId, notificationDomainEvents.CASE_REOPENED, {
      previousCycleNo,
      newCycleNo
    });
  } catch (error) {
    console.error('[caseExecutionService] onCaseReopened failed:', error.message);
  }
}

async function onCaseActivityLogged({ caseRecord, actorId, activityType }) {
  try {
    emitCaseDomainEvent(
      caseRecord,
      actorId,
      'case.activity.logged',
      null,
      { activityType: activityType || null, status: caseRecord?.status || null }
    );
  } catch (error) {
    console.error('[caseExecutionService] onCaseActivityLogged failed:', error.message);
  }
}

module.exports = {
  onCaseCreated,
  onCaseUpdated,
  onCaseStatusChanged,
  onCaseReopened,
  onCaseActivityLogged
};
