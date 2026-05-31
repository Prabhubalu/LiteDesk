/** Client mirror of server/constants/caseLifecycle.js — keep in sync. */
export const CASE_TYPES = ['Support Ticket', 'Complaint', 'Service Request', 'Warranty Claim', 'Internal Case'];
export const CASE_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
export const CASE_STATUSES = ['New', 'Assigned', 'In Progress', 'On Hold', 'Waiting for Customer', 'Resolved', 'Closed'];
export const CASE_CHANNELS = ['Email', 'Live Chat', 'Phone', 'Customer Portal', 'Partner Portal', 'Internal'];

/** Statuses that freeze the SLA clock while active. */
export const SLA_PAUSE_STATUSES = ['On Hold', 'Waiting for Customer'];

export const CASE_STATUS_TRANSITIONS = {
  New: ['Assigned', 'In Progress'],
  Assigned: ['In Progress', 'On Hold', 'Waiting for Customer'],
  'In Progress': ['On Hold', 'Waiting for Customer', 'Resolved'],
  'On Hold': ['In Progress', 'Waiting for Customer', 'Resolved'],
  'Waiting for Customer': ['In Progress', 'Resolved'],
  Resolved: ['Closed'],
  Closed: []
};

export function getAllowedCaseStatusTransitions(currentStatus) {
  return CASE_STATUS_TRANSITIONS[currentStatus] || [];
}
