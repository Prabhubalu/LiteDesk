'use strict';

/**
 * Labels, grouping, and condition field hints for automation rule triggers.
 */
const APPOINTMENT_CONDITION_FIELDS = [
  { value: 'currentState.status', label: 'Event status' },
  { value: 'currentState.appointment.appointmentType', label: 'Appointment type' },
  { value: 'currentState.appointment.bookingSource', label: 'Booking source' },
  { value: 'currentState.appointment.meetingType', label: 'Meeting format' },
  { value: 'previousState.status', label: 'Previous status' }
];

const DEAL_CONDITION_FIELDS = [
  { value: 'currentState.stage', label: 'Current stage' },
  { value: 'currentState.pipeline', label: 'Current pipeline' },
  { value: 'previousState.stage', label: 'Previous stage' }
];

const PEOPLE_CONDITION_FIELDS = [
  { value: 'currentState.sales_type', label: 'Current SALES role' },
  { value: 'previousState.sales_type', label: 'Previous SALES role' }
];

const EVENT_METADATA = {
  'people.lifecycle.changed': {
    label: 'People lifecycle changed',
    category: 'crm',
    suggestedEntityType: 'people',
    conditionFields: PEOPLE_CONDITION_FIELDS
  },
  'people.sales_type.changed': {
    label: 'People sales type changed',
    category: 'crm',
    suggestedEntityType: 'people',
    conditionFields: PEOPLE_CONDITION_FIELDS
  },
  'organization.lifecycle.changed': {
    label: 'Organization lifecycle changed',
    category: 'crm',
    suggestedEntityType: 'organization',
    conditionFields: []
  },
  'organization.type.changed': {
    label: 'Organization type changed',
    category: 'crm',
    suggestedEntityType: 'organization',
    conditionFields: []
  },
  'deal.stage.changed': {
    label: 'Deal stage changed',
    category: 'crm',
    suggestedEntityType: 'deal',
    conditionFields: DEAL_CONDITION_FIELDS
  },
  'deal.pipeline.changed': {
    label: 'Deal pipeline changed',
    category: 'crm',
    suggestedEntityType: 'deal',
    conditionFields: DEAL_CONDITION_FIELDS
  },
  'deal.deal.won': {
    label: 'Deal won',
    category: 'crm',
    suggestedEntityType: 'deal',
    conditionFields: DEAL_CONDITION_FIELDS
  },
  'deal.deal.lost': {
    label: 'Deal lost',
    category: 'crm',
    suggestedEntityType: 'deal',
    conditionFields: DEAL_CONDITION_FIELDS
  },
  'target.lifecycle.activated': {
    label: 'Target activated',
    category: 'performance',
    suggestedEntityType: 'target',
    conditionFields: [
      { value: 'currentState.lifecycleStatus', label: 'Lifecycle status' },
      { value: 'currentState.targetValue', label: 'Target value' }
    ]
  },
  'target.progress.updated': {
    label: 'Target progress updated',
    category: 'performance',
    suggestedEntityType: 'target',
    conditionFields: [
      { value: 'currentState.percent', label: 'Achieved percent' },
      { value: 'currentState.achievedValue', label: 'Achieved value' }
    ]
  },
  'target.threshold.crossed': {
    label: 'Target threshold crossed',
    category: 'performance',
    suggestedEntityType: 'target',
    conditionFields: [
      { value: 'currentState.thresholdPercent', label: 'Threshold percent' },
      { value: 'currentState.achievedPercent', label: 'Achieved percent' }
    ]
  },
  'target.status.changed': {
    label: 'Target status changed',
    category: 'performance',
    suggestedEntityType: 'target',
    conditionFields: [
      { value: 'currentState.status', label: 'Status' }
    ]
  },
  'appointment.created': {
    label: 'Appointment booked',
    category: 'appointments',
    suggestedEntityType: 'events',
    conditionFields: APPOINTMENT_CONDITION_FIELDS
  },
  'appointment.updated': {
    label: 'Appointment updated',
    category: 'appointments',
    suggestedEntityType: 'events',
    conditionFields: APPOINTMENT_CONDITION_FIELDS
  },
  'appointment.completed': {
    label: 'Appointment completed',
    category: 'appointments',
    suggestedEntityType: 'events',
    conditionFields: APPOINTMENT_CONDITION_FIELDS
  },
  'appointment.cancelled': {
    label: 'Appointment cancelled',
    category: 'appointments',
    suggestedEntityType: 'events',
    conditionFields: APPOINTMENT_CONDITION_FIELDS
  },
  'appointment.no_show': {
    label: 'Appointment no-show',
    category: 'appointments',
    suggestedEntityType: 'events',
    conditionFields: APPOINTMENT_CONDITION_FIELDS
  },
  'webform.submission.processed': {
    label: 'Webform submission processed',
    category: 'crm',
    suggestedEntityType: 'webform_submission',
    conditionFields: [
      { value: 'currentState.crmAction', label: 'CRM action' },
      { value: 'currentState.targetModuleKey', label: 'Target module' },
      { value: 'currentState.status', label: 'Submission status' }
    ]
  }
};

const CATEGORY_LABELS = {
  appointments: 'Appointments',
  crm: 'CRM'
};

function getEventMetadata(eventType) {
  return EVENT_METADATA[eventType] || {
    label: eventType.replace(/\./g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    category: 'other',
    suggestedEntityType: '',
    conditionFields: []
  };
}

function buildPreviewTestEvent(rule, { organizationId, userId } = {}) {
  const eventType = rule.trigger?.eventType;
  const base = {
    eventId: `preview-${Date.now()}`,
    eventType,
    appKey: rule.appKey || 'SALES',
    organizationId: organizationId || null,
    triggeredBy: userId || null,
    assignedTo: userId || null,
    previousState: null,
    currentState: {}
  };

  if (eventType?.startsWith('appointment.')) {
    const statusByEvent = {
      'appointment.created': 'Planned',
      'appointment.updated': 'Planned',
      'appointment.completed': 'Completed',
      'appointment.cancelled': 'Cancelled',
      'appointment.no_show': 'Planned'
    };
    const status = statusByEvent[eventType] || 'Planned';
    base.entityType = rule.entityType || 'events';
    base.entityId = '507f1f77bcf86cd799439011';
    base.previousState = eventType === 'appointment.completed' ? { status: 'Planned' } : null;
    base.currentState = {
      status,
      startDateTime: new Date().toISOString(),
      endDateTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      appointment: {
        isAppointment: true,
        appointmentType: 'consultation',
        bookingSource: 'public_page',
        meetingType: 'online',
        bookedByEmail: 'guest@example.com',
        bookedByName: 'Preview Guest',
        noShow: eventType === 'appointment.no_show'
      }
    };
    return base;
  }

  if (eventType === 'webform.submission.processed') {
    base.entityType = rule.entityType || 'webform_submission';
    base.entityId = '507f1f77bcf86cd799439011';
    base.currentState = {
      webformId: 'WFM-001',
      webformName: 'Preview Webform',
      submissionId: '507f1f77bcf86cd799439012',
      status: 'processed',
      crmAction: 'created',
      targetModuleKey: 'people',
      crmRecordId: '507f1f77bcf86cd799439011'
    };
    return base;
  }

  if (eventType?.startsWith('deal.')) {
    base.entityType = rule.entityType || 'deal';
    base.entityId = '507f1f77bcf86cd799439011';
    base.previousState = { stage: 'Proposal' };
    base.currentState = { stage: 'Closed Won', pipeline: 'Default' };
    return base;
  }

  base.entityType = rule.entityType || 'people';
  base.entityId = '507f1f77bcf86cd799439011';
  base.currentState = { sales_type: 'Lead' };
  return base;
}

module.exports = {
  EVENT_METADATA,
  CATEGORY_LABELS,
  getEventMetadata,
  buildPreviewTestEvent
};
