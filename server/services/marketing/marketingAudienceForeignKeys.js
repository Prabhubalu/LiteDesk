'use strict';

/** FK field on childModule that references parentModule (_id). */
const MODULE_PARENT_FOREIGN_KEYS = Object.freeze({
  'deals:people': 'contactId',
  'deals:organizations': 'accountId',
  'cases:people': 'contactId',
  'cases:organizations': 'organizationRefId',
  'people:organizations': 'organization',
  'quotes:people': 'contactId',
  'quotes:organizations': 'organizationRefId',
  'quotes:deals': 'dealId',
  'quotes:cases': 'caseId',
  'invoices:people': 'contactId',
  'invoices:organizations': 'organizationRefId',
  'invoices:deals': 'dealId',
  'invoices:cases': 'caseId',
  'sales_orders:people': 'contactId',
  'sales_orders:organizations': 'organizationRefId',
  'sales_orders:deals': 'dealId',
  'sales_orders:cases': 'caseId',
  'payments:people': 'contactId',
  'payments:organizations': 'organizationRefId',
});

/** Primary module -> relationship key used to map record IDs back to people. */
const PRIMARY_TO_PEOPLE_RELATIONSHIP_KEYS = Object.freeze({
  deals: 'people_deals',
  cases: 'case_people',
  quotes: 'quote_people',
  invoices: 'quote_people',
  sales_orders: 'quote_people'
});

function normalizeModuleKey(moduleKey) {
  return String(moduleKey || '').toLowerCase();
}

function inferForeignKeyOnChild(childModuleKey, parentModuleKey) {
  const child = normalizeModuleKey(childModuleKey);
  const parent = normalizeModuleKey(parentModuleKey);
  return MODULE_PARENT_FOREIGN_KEYS[`${child}:${parent}`] || null;
}

function inferForwardForeignKeyField(edge) {
  if (edge?.localField) return edge.localField;
  return inferForeignKeyOnChild(edge.fromModuleKey, edge.toModuleKey);
}

function inferForeignKeyFromChildToParent(childModuleKey, parentModuleKey, edge = null) {
  if (edge?.reverseLocalField && normalizeModuleKey(edge.reverseSourceModuleKey) === normalizeModuleKey(childModuleKey)) {
    return edge.reverseLocalField;
  }
  return inferForeignKeyOnChild(childModuleKey, parentModuleKey);
}

module.exports = {
  MODULE_PARENT_FOREIGN_KEYS,
  PRIMARY_TO_PEOPLE_RELATIONSHIP_KEYS,
  normalizeModuleKey,
  inferForeignKeyOnChild,
  inferForwardForeignKeyField,
  inferForeignKeyFromChildToParent
};
