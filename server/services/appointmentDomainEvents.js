const { emit } = require('./domainEvents');

/**
 * Emit automation-ready domain events for appointment lifecycle.
 * @param {'appointment.created'|'appointment.updated'|'appointment.cancelled'|'appointment.completed'|'appointment.no_show'} eventType
 * @param {Object} event - Mongoose event doc or plain object
 * @param {Object} [opts]
 */
function emitAppointmentDomainEvent(eventType, event, opts = {}) {
  if (!event) return;
  const doc = event.toObject ? event.toObject() : event;
  emit({
    entityType: 'events',
    entityId: doc._id,
    eventType,
    previousState: opts.previousState ?? null,
    currentState: {
      status: doc.status,
      startDateTime: doc.startDateTime,
      endDateTime: doc.endDateTime,
      appointment: doc.appointment
    },
    appKey: opts.appKey || 'SALES',
    triggeredBy: opts.triggeredBy ?? doc.modifiedBy ?? doc.createdBy,
    organizationId: doc.organizationId,
    assignedTo: doc.assignedTo
  });
}

module.exports = { emitAppointmentDomainEvent };
