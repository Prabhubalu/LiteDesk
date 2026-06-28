/**
 * Resolve module field labels: system catalog, then tenant phrase catalog, then API label.
 */

import { resolveTenantFieldLabel } from '@/utils/configurableLabelResolver';

/** @type {Record<string, Record<string, string>>} */
const SYSTEM_FIELD_LABEL_KEYS = {
  people: {
    assignedto: 'people.sysFieldAssignedTo',
    assigned_to: 'people.sysFieldAssignedTo',
    email: 'people.sysFieldEmail',
    phone: 'people.sysFieldPhone',
    mobile: 'people.sysFieldMobile',
    firstname: 'people.sysFieldFirstName',
    first_name: 'people.sysFieldFirstName',
    lastname: 'people.sysFieldLastName',
    last_name: 'people.sysFieldLastName',
    name: 'people.sysFieldName',
    organization: 'people.sysFieldOrganization',
    organizationid: 'people.sysFieldOrganization',
    organization_id: 'people.sysFieldOrganization',
    description: 'people.sysFieldDescription',
    tags: 'people.sysFieldTags',
    donotcontact: 'people.sysFieldDoNotContact',
    do_not_contact: 'people.sysFieldDoNotContact',
    title: 'people.sysFieldTitle',
    type: 'people.sysFieldType',
    status: 'people.sysFieldStatus',
    source: 'people.sysFieldSource',
    owner: 'people.sysFieldOwner',
    ownerid: 'people.sysFieldOwner',
    createdby: 'people.sysFieldCreatedBy',
    created_by: 'people.sysFieldCreatedBy',
  },
  organizations: {
    name: 'organizations.sysFieldName',
    email: 'organizations.sysFieldEmail',
    phone: 'organizations.sysFieldPhone',
    website: 'organizations.sysFieldWebsite',
    industry: 'organizations.sysFieldIndustry',
    assignedto: 'organizations.sysFieldAssignedTo',
    assigned_to: 'organizations.sysFieldAssignedTo',
    description: 'organizations.sysFieldDescription',
    tags: 'organizations.sysFieldTags',
  },
  deals: {
    name: 'deals.sysFieldName',
    title: 'deals.sysFieldName',
    amount: 'deals.sysFieldAmount',
    stage: 'deals.sysFieldStage',
    pipeline: 'deals.sysFieldPipeline',
    probability: 'deals.sysFieldProbability',
    expectedclosedate: 'deals.sysFieldExpectedCloseDate',
    expected_close_date: 'deals.sysFieldExpectedCloseDate',
    close_date: 'deals.sysFieldExpectedCloseDate',
    ownerid: 'deals.sysFieldAssignedTo',
    owner_id: 'deals.sysFieldAssignedTo',
    dealowner: 'deals.sysFieldAssignedTo',
    accountid: 'deals.sysFieldAccountId',
    account_id: 'deals.sysFieldAccountId',
    organization: 'deals.sysFieldAccountId',
    contactid: 'deals.sysFieldContactId',
    contact_id: 'deals.sysFieldContactId',
    contact: 'deals.sysFieldContactId',
    type: 'deals.sysFieldType',
    dealtype: 'deals.sysFieldDealType',
    deal_type: 'deals.sysFieldDealType',
    nextstep: 'deals.sysFieldNextStep',
    next_step: 'deals.sysFieldNextStep',
    tags: 'deals.sysFieldTags',
    assignedto: 'deals.sysFieldAssignedTo',
    assigned_to: 'deals.sysFieldAssignedTo',
    description: 'deals.sysFieldDescription',
  },
  tasks: {
    title: 'tasks.sysFieldTitle',
    name: 'tasks.sysFieldTitle',
    status: 'tasks.sysFieldStatus',
    assignedto: 'tasks.sysFieldAssignedTo',
    assigned_to: 'tasks.sysFieldAssignedTo',
    duedate: 'tasks.sysFieldDueDate',
    due_date: 'tasks.sysFieldDueDate',
    description: 'tasks.sysFieldDescription',
  },
  events: {
    assignedto: 'common.assignedTo',
    assigned_to: 'common.assignedTo',
    appointmentbookedby: 'events.sysFieldAppointmentBookedBy',
    appointmentbookingsource: 'events.sysFieldAppointmentBookingSource',
    appointmenttype: 'events.sysFieldAppointmentType',
    appointmentmeetinglink: 'events.sysFieldAppointmentMeetingLink',
  },
  cases: {
    assignedto: 'common.assignedTo',
    assigned_to: 'common.assignedTo',
    responsemetat: 'cases.listColumnResponseSla',
    firstresponsedueat: 'cases.recordSlaResponse',
  },
};

function normalizeFieldKey(fieldKey) {
  return String(fieldKey || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
}

/**
 * @param {string} moduleKey
 * @param {{ key?: string, label?: string }} field
 * @param {(key: string) => string} t
 * @param {(key: string) => boolean} te
 */
export function resolveFieldLabel(moduleKey, field, t, te) {
  const mod = String(moduleKey || '').toLowerCase();
  const fk = normalizeFieldKey(field?.key);
  if ((fk === 'assignedto' || fk === 'assigned_to') && te('common.assignedTo')) {
    return t('common.assignedTo');
  }
  const catalog = SYSTEM_FIELD_LABEL_KEYS[mod];
  const i18nKey = catalog?.[fk];
  if (i18nKey && te(i18nKey)) {
    return t(i18nKey);
  }

  const apiLabel = String(field?.label || '').trim();
  const tenantLabel = resolveTenantFieldLabel(mod, field?.key, apiLabel, t, te);
  if (tenantLabel) return tenantLabel;

  return apiLabel || field?.key || '';
}
