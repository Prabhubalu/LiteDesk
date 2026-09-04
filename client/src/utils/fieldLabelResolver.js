/**
 * Resolve module field labels: system catalog, then tenant phrase catalog, then API label.
 */

import { resolveTenantFieldLabel } from '@/utils/configurableLabelResolver';
import { applyTenantModuleTermsToLabel } from '@/utils/registryModuleLabels';

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
    salutation: 'people.sysFieldSalutation',
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
    derivedstatus: 'people.sysFieldStatus',
    createdat: 'people.sysFieldCreatedOn',
    lastactivity: 'common.phraseLastActivity',
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
    derivedstatus: 'organizations.sysFieldStatus',
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
    meetingmode: 'events.sysFieldMeetingMode',
    meetinglink: 'events.sysFieldMeetingLink',
    conferenceprovider: 'events.sysFieldConferenceProvider',
    attendees: 'events.sysFieldAttendees',
    agendanotes: 'events.sysFieldAgendaNotes',
    location: 'events.sysFieldLocation',
    georequired: 'events.sysFieldGeoRequired',
    eventname: 'events.sysFieldEventName',
    eventtype: 'events.sysFieldEventType',
    startdatetime: 'events.sysFieldStartDateTime',
    enddatetime: 'events.sysFieldEndDateTime',
  },
  items: {
    assignedto: 'common.assignedTo',
    assigned_to: 'common.assignedTo',
    lifecyclestate: 'common.status',
    lifecycle_state: 'common.status',
  },
  cases: {
    assignedto: 'common.assignedTo',
    assigned_to: 'common.assignedTo',
    contactid: 'cases.sysFieldContactId',
    contact_id: 'cases.sysFieldContactId',
    organizationrefid: 'cases.sysFieldOrganizationRefId',
    organization_ref_id: 'cases.sysFieldOrganizationRefId',
    responsemetat: 'cases.listColumnResponseSla',
    firstresponsedueat: 'cases.recordSlaResponse',
  },
  reports: {
    name: 'analytics.colName',
    type: 'analytics.colType',
    primarymodule: 'analytics.colModule',
    primary_module: 'analytics.colModule',
    status: 'analytics.colStatus',
    updatedat: 'analytics.colUpdated',
    updated_at: 'analytics.colUpdated',
    ownerid: 'analytics.colOwner',
    owner_id: 'analytics.colOwner',
  },
  widgets: {
    name: 'analytics.colName',
    charttype: 'analytics.colChartType',
    chart_type: 'analytics.colChartType',
    reportid: 'analytics.colReport',
    report_id: 'analytics.colReport',
    status: 'analytics.colStatus',
    updatedat: 'analytics.colUpdated',
    updated_at: 'analytics.colUpdated',
  },
  dashboards: {
    name: 'analytics.colName',
    category: 'analytics.colCategory',
    widgetcount: 'analytics.colWidgets',
    widget_count: 'analytics.colWidgets',
    status: 'analytics.colStatus',
    updatedat: 'analytics.colUpdated',
    updated_at: 'analytics.colUpdated',
  },
  purchase_orders: {
    subject: 'records.poSysFieldSubject',
    ponumber: 'records.poSysFieldNumber',
    podate: 'records.poSysFieldDate',
    vendorid: 'records.poSysFieldVendor',
    vendorcontactid: 'records.poSysFieldVendorContact',
    buyerid: 'records.poSysFieldOwner',
    status: 'records.poSysFieldStatus',
    currency: 'records.poSysFieldCurrency',
    expecteddeliverydate: 'records.poSysFieldExpectedReceipt',
    notes: 'records.poSysFieldVendorNotes',
    internalnotes: 'records.poSysFieldInternalNotes',
    deliverywarehouseid: 'records.poSysFieldWarehouse',
    deliverymethod: 'records.poSysFieldDeliveryMethod',
    grandtotal: 'records.poSysFieldGrandTotal',
  },
  purchase_returns: {
    subject: 'records.prSysFieldSubject',
    purchasereturnnumber: 'records.prSysFieldNumber',
    returndate: 'records.prSysFieldReturnDate',
    vendorid: 'records.prSysFieldVendor',
    vendorcontactid: 'records.prSysFieldVendorContact',
    ownerid: 'records.prSysFieldOwner',
    status: 'records.prSysFieldStatus',
    returntype: 'records.prSysFieldReturnType',
    returnreason: 'records.prSysFieldReason',
    supplierreference: 'records.prSysFieldSupplierRef',
    returnwarehouseid: 'records.prSysFieldWarehouse',
    currency: 'records.prSysFieldCurrency',
    vendornotes: 'records.prSysFieldVendorNotes',
    internalnotes: 'records.prSysFieldInternalNotes',
    notes: 'records.prSysFieldVendorNotes',
    receiptnoteid: 'records.prSysFieldReceiptNote',
    purchaseorderid: 'records.prSysFieldPurchaseOrder',
    grandtotal: 'records.prSysFieldGrandTotal',
  },
  delivery_returns: {
    subject: 'records.drSysFieldSubject',
    deliveryreturnnumber: 'records.drSysFieldNumber',
    returndate: 'records.drSysFieldReturnDate',
    customerid: 'records.drSysFieldCustomer',
    contactpersonid: 'records.drSysFieldContact',
    ownerid: 'records.drSysFieldOwner',
    status: 'records.drSysFieldStatus',
    sourcetype: 'records.drSysFieldSourceType',
    returntype: 'records.drSysFieldReturnType',
    returnreason: 'records.drSysFieldReason',
    customerreference: 'records.drSysFieldCustomerRef',
    returnwarehouseid: 'records.drSysFieldWarehouse',
    currency: 'records.drSysFieldCurrency',
    customernotes: 'records.drSysFieldCustomerNotes',
    internalnotes: 'records.drSysFieldInternalNotes',
    notes: 'records.drSysFieldCustomerNotes',
    deliverynoteid: 'records.drSysFieldDeliveryNote',
    invoiceid: 'records.drSysFieldInvoice',
    inventorypoststatus: 'records.drSysFieldInventoryPost',
    grandtotal: 'records.drSysFieldGrandTotal',
  },
  delivery_notes: {
    subject: 'records.dnSysFieldSubject',
    deliverynotenumber: 'records.dnSysFieldNumber',
    deliverydate: 'records.dnSysFieldDeliveryDate',
    customerid: 'records.dnSysFieldCustomer',
    contactpersonid: 'records.dnSysFieldContact',
    ownerid: 'records.dnSysFieldOwner',
    status: 'records.dnSysFieldStatus',
    sourcetype: 'records.dnSysFieldSourceType',
    salesorderid: 'records.dnSysFieldSalesOrder',
    warehouseid: 'records.dnSysFieldWarehouse',
    deliverymethod: 'records.dnSysFieldDeliveryMethod',
    carrier: 'records.dnSysFieldCarrier',
    trackingnumber: 'records.dnSysFieldTracking',
    currency: 'records.dnSysFieldCurrency',
    customernotes: 'records.dnSysFieldCustomerNotes',
    internalnotes: 'records.dnSysFieldInternalNotes',
    notes: 'records.dnSysFieldCustomerNotes',
    inventorypoststatus: 'records.dnSysFieldInventoryPost',
    grandtotal: 'records.dnSysFieldGrandTotal',
  },
  receipt_notes: {
    receiptnotenumber: 'records.rnSysFieldNumber',
    receiptdate: 'records.rnSysFieldDate',
    vendorid: 'records.rnSysFieldVendor',
    purchaseorderid: 'records.rnSysFieldPurchaseOrder',
    receiptlocationid: 'records.rnSysFieldLocation',
    receivedby: 'records.rnSysFieldReceivedBy',
    vendordeliverychallanno: 'records.rnSysFieldChallan',
    transportdetails: 'records.rnSysFieldTransport',
    status: 'records.rnSysFieldStatus',
    notes: 'records.rnSysFieldNotes',
  },
  stockrooms: {
    name: 'navigation.inventoryStockroomName',
    locationcode: 'navigation.inventoryStockroomCode',
    locationtype: 'navigation.inventoryStockroomType',
    status: 'navigation.inventoryStockroomStatus',
    isdefault: 'navigation.inventoryStockroomDefault',
    description: 'navigation.inventoryStockroomDescription',
    allownegative: 'navigation.inventoryStockroomAllowNegative',
  },
  stock_adjustments: {
    inventoryadjustmentid: 'records.adjSysFieldId',
    inventorylocationid: 'navigation.inventoryStockroom',
    inventorylocationname: 'navigation.inventoryStockroom',
    reasoncode: 'navigation.inventoryReason',
    status: 'records.adjSysFieldStatus',
    notes: 'records.adjNotes',
    postedat: 'records.adjSysFieldPostedAt',
    createdat: 'records.adjSysFieldCreatedAt',
  },
  stock_transfers: {
    inventorytransferid: 'records.xferSysFieldId',
    fromlocationid: 'navigation.inventorySourceStockroom',
    fromlocationname: 'navigation.inventorySourceStockroom',
    tolocationid: 'navigation.inventoryDestStockroom',
    tolocationname: 'navigation.inventoryDestStockroom',
    status: 'records.xferSysFieldStatus',
    notes: 'records.xferNotes',
    postedat: 'records.xferSysFieldPostedAt',
    createdat: 'records.xferSysFieldCreatedAt',
  },
  sales_returns: {
    salesreturnnumber: 'records.srSysFieldNumber',
    returndate: 'records.srSysFieldReturnDate',
    customerid: 'records.srSysFieldCustomer',
    invoiceid: 'records.srSysFieldInvoice',
    deliverynoteid: 'records.srSysFieldDeliveryNote',
    salesorderid: 'records.srSysFieldSalesOrder',
    returnlocationid: 'records.srSysFieldLocation',
    overallreturnreason: 'records.srSysFieldReason',
    returntype: 'records.srSysFieldReturnType',
    status: 'records.srSysFieldStatus',
    notes: 'records.srSysFieldNotes',
    grandtotal: 'records.srSysFieldGrandTotal',
  },
};

function normalizeFieldKey(fieldKey) {
  return String(fieldKey || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

/** Cross-module technical lookup keys — apply even when moduleKey is missing (list/customize). */
const GLOBAL_SYSTEM_FIELD_LABEL_KEYS = {
  contactid: 'cases.sysFieldContactId',
  organizationrefid: 'cases.sysFieldOrganizationRefId',
  dealid: 'common.sysFieldDeal',
  createdat: 'common.sysFieldCreatedOn',
  createdtime: 'common.sysFieldCreatedOn',
  updatedat: 'common.sysFieldModifiedOn',
  modifiedtime: 'common.sysFieldModifiedOn',
  createdby: 'common.sysFieldCreatedBy',
};

/**
 * @param {string} moduleKey
 * @param {{ key?: string, label?: string }} field
 * @param {(key: string) => string} t
 * @param {(key: string) => boolean} te
 */
export function resolveFieldLabel(moduleKey, field, t, te) {
  const mod = String(moduleKey || '').toLowerCase();
  const fk = normalizeFieldKey(field?.key);
  if (fk === 'assignedto' && te('common.assignedTo')) {
    return t('common.assignedTo');
  }
  const catalog = SYSTEM_FIELD_LABEL_KEYS[mod];
  const catalogKey =
    catalog?.[fk] ||
    (catalog
      ? Object.entries(catalog).find(([k]) => normalizeFieldKey(k) === fk)?.[1]
      : undefined);
  const i18nKey = catalogKey || GLOBAL_SYSTEM_FIELD_LABEL_KEYS[fk];
  if (i18nKey && te(i18nKey)) {
    return applyTenantModuleTermsToLabel(mod, t(i18nKey));
  }

  const apiLabel = String(field?.label || '').trim();
  const tenantLabel = resolveTenantFieldLabel(mod, field?.key, apiLabel, t, te);
  if (tenantLabel) return tenantLabel;

  return apiLabel || field?.key || '';
}
