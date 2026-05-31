const CASE_TYPES = ['Support Ticket', 'Complaint', 'Service Request', 'Warranty Claim', 'Internal Case'];
const CASE_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const CASE_STATUSES = ['New', 'Assigned', 'In Progress', 'On Hold', 'Waiting for Customer', 'Resolved', 'Closed'];
const CASE_CHANNELS = ['Email', 'Live Chat', 'Phone', 'Customer Portal', 'Partner Portal', 'Internal'];

/** Statuses that freeze the SLA clock while active. */
const SLA_PAUSE_STATUSES = ['On Hold', 'Waiting for Customer'];

// Locked lifecycle contract for Helpdesk Cases.
const CASE_STATUS_TRANSITIONS = {
  New: ['Assigned', 'In Progress'],
  Assigned: ['In Progress', 'On Hold', 'Waiting for Customer'],
  'In Progress': ['On Hold', 'Waiting for Customer', 'Resolved'],
  'On Hold': ['In Progress', 'Waiting for Customer', 'Resolved'],
  'Waiting for Customer': ['In Progress', 'Resolved'],
  Resolved: ['Closed'],
  Closed: []
};

module.exports = {
  CASE_TYPES,
  CASE_PRIORITIES,
  CASE_STATUSES,
  CASE_CHANNELS,
  CASE_STATUS_TRANSITIONS,
  SLA_PAUSE_STATUSES
};
