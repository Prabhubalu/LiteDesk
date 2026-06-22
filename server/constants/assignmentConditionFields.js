'use strict';

const {
  CASE_TYPES,
  CASE_PRIORITIES,
  CASE_CHANNELS,
  CASE_STATUSES
} = require('./caseLifecycle');

function picklistOptions(values) {
  return (Array.isArray(values) ? values : []).map((value) => ({ value, label: value }));
}

function field(key, label, dataType = 'text', options = []) {
  return {
    key,
    label,
    dataType,
    options: Array.isArray(options) ? options : []
  };
}

const SUPPLEMENTAL_BY_SCOPE = {
  'helpdesk:cases': [
    field('priority', 'Priority', 'picklist', picklistOptions(CASE_PRIORITIES)),
    field('status', 'Status', 'picklist', picklistOptions(CASE_STATUSES)),
    field('caseType', 'Case type', 'picklist', picklistOptions(CASE_TYPES)),
    field('channel', 'Channel', 'picklist', picklistOptions(CASE_CHANNELS)),
    field('title', 'Title', 'text'),
    field('caseId', 'Case ID', 'text'),
    field('contactId', 'Contact', 'lookup'),
    field('organizationRefId', 'Organization', 'lookup'),
    field('caseOwnerId', 'Case owner', 'lookup'),
    field('source', 'Source', 'text'),
    field('severity', 'Severity', 'picklist'),
    field('impact', 'Impact', 'picklist')
  ],
  // People exists in multiple apps; expose the same assignment-relevant fields for HELPDESK too.
  'helpdesk:people': [
    field('assignedTo', 'Assigned to', 'lookup'),
    field('lead_owner', 'Lead owner', 'lookup'),
    field('organization', 'Organization', 'lookup'),
    field('derivedStatus', 'Status', 'text'),
    field('first_name', 'First name', 'text'),
    field('last_name', 'Last name', 'text'),
    field('email', 'Email', 'email'),
    field('type', 'Type', 'picklist'),
    field('sales_type', 'Sales type', 'picklist'),
    field('lead_status', 'Lead status', 'picklist', picklistOptions(['New', 'Contacted', 'Qualified', 'Disqualified', 'Nurturing', 'Re-Engage'])),
    field('contact_status', 'Contact status', 'picklist', picklistOptions(['Active', 'Inactive', 'DoNotContact'])),
    field('helpdesk_role', 'Helpdesk role', 'picklist'),
    field('role', 'Role', 'picklist', picklistOptions(['Decision Maker', 'Influencer', 'Support', 'Other'])),
    field('preferred_contact_method', 'Preferred contact method', 'picklist', picklistOptions(['Email', 'Phone', 'WhatsApp', 'SMS', 'None'])),
    field('do_not_contact', 'Do not contact', 'boolean'),
    field('tags', 'Tags', 'multi-picklist')
  ],
  // PLATFORM → people should behave like SALES/HELPDESK people for condition fields.
  'platform:people': [
    field('assignedTo', 'Assigned to', 'lookup'),
    field('lead_owner', 'Lead owner', 'lookup'),
    field('organization', 'Organization', 'lookup'),
    field('derivedStatus', 'Status', 'text'),
    field('first_name', 'First name', 'text'),
    field('last_name', 'Last name', 'text'),
    field('email', 'Email', 'email'),
    field('type', 'Type', 'picklist'),
    field('sales_type', 'Sales type', 'picklist'),
    field('lead_status', 'Lead status', 'picklist', picklistOptions(['New', 'Contacted', 'Qualified', 'Disqualified', 'Nurturing', 'Re-Engage'])),
    field('contact_status', 'Contact status', 'picklist', picklistOptions(['Active', 'Inactive', 'DoNotContact'])),
    field('helpdesk_role', 'Helpdesk role', 'picklist'),
    field('role', 'Role', 'picklist', picklistOptions(['Decision Maker', 'Influencer', 'Support', 'Other'])),
    field('preferred_contact_method', 'Preferred contact method', 'picklist', picklistOptions(['Email', 'Phone', 'WhatsApp', 'SMS', 'None'])),
    field('do_not_contact', 'Do not contact', 'boolean'),
    field('tags', 'Tags', 'multi-picklist')
  ],
  'sales:people': [
    field('assignedTo', 'Assigned to', 'lookup'),
    field('lead_owner', 'Lead owner', 'lookup'),
    field('organization', 'Organization', 'lookup'),
    field('derivedStatus', 'Status', 'text'),
    field('first_name', 'First name', 'text'),
    field('last_name', 'Last name', 'text'),
    field('email', 'Email', 'email'),
    field('type', 'Type', 'picklist'),
    field('sales_type', 'Sales type', 'picklist'),
    field('lead_status', 'Lead status', 'picklist', picklistOptions(['New', 'Contacted', 'Qualified', 'Disqualified', 'Nurturing', 'Re-Engage'])),
    field('contact_status', 'Contact status', 'picklist', picklistOptions(['Active', 'Inactive', 'DoNotContact'])),
    field('helpdesk_role', 'Helpdesk role', 'picklist'),
    field('role', 'Role', 'picklist', picklistOptions(['Decision Maker', 'Influencer', 'Support', 'Other'])),
    field('preferred_contact_method', 'Preferred contact method', 'picklist', picklistOptions(['Email', 'Phone', 'WhatsApp', 'SMS', 'None'])),
    field('do_not_contact', 'Do not contact', 'boolean'),
    field('tags', 'Tags', 'multi-picklist')
  ],
  'sales:organizations': [
    field('name', 'Name', 'text'),
    field('assignedTo', 'Assigned to', 'lookup'),
    field('types', 'Types', 'multi-picklist'),
    field('customerStatus', 'Customer status', 'picklist', picklistOptions(['Active', 'Prospect', 'Churned', 'Lead Customer'])),
    field('partnerStatus', 'Partner status', 'picklist', picklistOptions(['Active', 'Onboarding', 'Inactive'])),
    field('vendorStatus', 'Vendor status', 'picklist', picklistOptions(['Approved', 'Pending', 'Suspended'])),
    field('derivedStatus', 'Status', 'text'),
    field('territory', 'Territory', 'text'),
    field('industry', 'Industry', 'text'),
    field('accountManager', 'Account manager', 'lookup'),
    field('tags', 'Tags', 'multi-picklist')
  ],
  'sales:deals': [
    field('name', 'Name', 'text'),
    field('ownerId', 'Owner', 'lookup'),
    field('stage', 'Stage', 'picklist'),
    field('pipeline', 'Pipeline', 'picklist'),
    field('status', 'Status', 'picklist', picklistOptions(['Open', 'Won', 'Lost', 'Stalled', 'Active', 'Abandoned'])),
    field('priority', 'Priority', 'picklist', picklistOptions(['Low', 'Medium', 'High', 'Urgent'])),
    field('amount', 'Amount', 'currency'),
    field('probability', 'Probability', 'percent'),
    field('accountId', 'Account', 'lookup'),
    field('contactId', 'Contact', 'lookup'),
    field('type', 'Type', 'picklist', picklistOptions(['New Business', 'Existing Customer', 'Existing Business', 'Upsell', 'Renewal', 'Cross-Sell'])),
    field('derivedStatus', 'Derived status', 'text'),
    field('currency', 'Currency', 'text'),
    field('tags', 'Tags', 'multi-picklist')
  ],
  'sales:tasks': [
    field('title', 'Title', 'text'),
    field('assignedTo', 'Assigned to', 'lookup'),
    field('status', 'Status', 'picklist', picklistOptions(['todo', 'in_progress', 'waiting', 'completed', 'cancelled'])),
    field('priority', 'Priority', 'picklist', picklistOptions(['low', 'medium', 'high', 'urgent'])),
    field('dueDate', 'Due date', 'date'),
    field('projectId', 'Project', 'lookup'),
    field('relatedTo.type', 'Related record type', 'picklist', picklistOptions(['contact', 'deal', 'project', 'organization', 'none'])),
    field('tags', 'Tags', 'multi-picklist')
  ],
  'sales:events': [
    field('title', 'Title', 'text'),
    field('status', 'Status', 'picklist'),
    field('name', 'Name', 'text')
  ],
  'sales:items': [
    field('name', 'Name', 'text'),
    field('status', 'Status', 'picklist')
  ],
  'sales:forms': [
    field('name', 'Name', 'text'),
    field('status', 'Status', 'picklist')
  ],
  'platform:live_chat_sessions': [
    field('queueKey', 'Queue', 'text'),
    field('queueId', 'Queue ID', 'lookup'),
    field('lifecycleStatus', 'Lifecycle status', 'picklist', picklistOptions(['waiting', 'assigned', 'active', 'ended', 'bot_handling'])),
    field('channel', 'Channel', 'picklist', picklistOptions(['web'])),
    field('pageUrl', 'Page URL', 'text'),
    field('sessionKey', 'Session key', 'text'),
    field('assignedAgentId', 'Assigned agent', 'lookup'),
    field('visitor.email', 'Visitor email', 'email'),
    field('visitor.name', 'Visitor name', 'text'),
    field('status', 'Status', 'picklist', picklistOptions(['open', 'closed']))
  ]
};

const GENERIC_FALLBACK = [
  field('status', 'Status', 'picklist'),
  field('priority', 'Priority', 'picklist'),
  field('title', 'Title', 'text'),
  field('name', 'Name', 'text'),
  field('assignedTo', 'Assigned to', 'lookup')
];

function scopeKey(appKey, moduleKey) {
  return `${String(appKey || '').toLowerCase()}:${String(moduleKey || '').toLowerCase()}`;
}

function getSupplementalAssignmentConditionFields(appKey, moduleKey) {
  const key = scopeKey(appKey, moduleKey);
  return SUPPLEMENTAL_BY_SCOPE[key] || GENERIC_FALLBACK;
}

function mergeConditionFields(primary = [], supplemental = []) {
  const map = new Map();
  for (const row of [...supplemental, ...primary]) {
    const fieldKey = String(row?.key || '').trim();
    if (!fieldKey) continue;
    const existing = map.get(fieldKey);
    if (!existing) {
      map.set(fieldKey, { ...row, key: fieldKey });
      continue;
    }
    map.set(fieldKey, {
      ...row,
      ...existing,
      key: fieldKey,
      label: existing.label || row.label || fieldKey,
      dataType: existing.dataType || row.dataType || 'text',
      options: Array.isArray(existing.options) && existing.options.length > 0
        ? existing.options
        : (Array.isArray(row.options) ? row.options : [])
    });
  }
  return Array.from(map.values()).sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

module.exports = {
  getSupplementalAssignmentConditionFields,
  mergeConditionFields,
  scopeKey
};
