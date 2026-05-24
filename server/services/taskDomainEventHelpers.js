'use strict';

const { emit } = require('./domainEvents');

function toId(v) {
  if (v == null) return null;
  return v.toString ? v.toString() : String(v);
}

function emitTaskDomainEvent({ task, eventType, previousState, currentState, triggeredBy, appKey = 'PLATFORM' }) {
  emit({
    entityType: 'task',
    entityId: toId(task._id),
    eventType,
    previousState: previousState || null,
    currentState: currentState || {
      status: task.status,
      assignedTo: toId(task.assignedTo),
      priority: task.priority
    },
    appKey,
    organizationId: task.organizationId?.toString?.() || task.organizationId,
    triggeredBy: triggeredBy || null,
    ownerId: toId(task.assignedTo)
  });
}

module.exports = {
  emitTaskDomainEvent
};
