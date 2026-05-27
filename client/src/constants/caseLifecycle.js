/** Client mirror of server/constants/caseLifecycle.js — keep in sync. */
export const CASE_TYPES = ['Support Ticket', 'Complaint', 'Service Request', 'Warranty Claim', 'Internal Case'];
export const CASE_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
export const CASE_STATUSES = ['New', 'Assigned', 'In Progress', 'On Hold', 'Resolved', 'Closed'];
export const CASE_CHANNELS = ['Email', 'Live Chat', 'Phone', 'Customer Portal', 'Partner Portal', 'Internal'];

export const CASE_STATUS_TRANSITIONS = {
  New: ['Assigned'],
  Assigned: ['In Progress', 'On Hold'],
  'In Progress': ['On Hold', 'Resolved'],
  'On Hold': ['In Progress', 'Resolved'],
  Resolved: ['Closed'],
  Closed: []
};

export function getAllowedCaseStatusTransitions(currentStatus) {
  return CASE_STATUS_TRANSITIONS[currentStatus] || [];
}
