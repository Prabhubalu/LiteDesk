/**
 * Platform defaults: organization type → field keys.
 * Keep in sync with client/src/platform/fields/organizationFieldModel.ts ORGANIZATION_TYPE_FIELDS.
 */

const ORGANIZATION_ALWAYS_VISIBLE_FIELD_KEYS = new Set([
  'name',
  'industry',
  'website',
  'phone',
  'address',
  'types',
  'tags',
  'assignedto',
  'accountmanager',
  'primarycontact',
  'isactive'
]);

const ORGANIZATION_TYPE_FIELDS = Object.freeze({
  Customer: Object.freeze([
    'customerStatus',
    'customerTier',
    'slaLevel',
    'paymentTerms',
    'creditLimit',
    'accountManager',
    'annualRevenue',
    'numberOfEmployees'
  ]),
  // Sales / Marketing funnel roles share the customer field pool
  Lead: Object.freeze([
    'customerStatus',
    'customerTier',
    'slaLevel',
    'paymentTerms',
    'creditLimit',
    'accountManager',
    'annualRevenue',
    'numberOfEmployees'
  ]),
  'Marketing Lead': Object.freeze([
    'customerStatus',
    'customerTier',
    'slaLevel',
    'paymentTerms',
    'creditLimit',
    'accountManager',
    'annualRevenue',
    'numberOfEmployees'
  ]),
  Partner: Object.freeze([
    'partnerStatus',
    'partnerTier',
    'partnerType',
    'partnerSince',
    'territory',
    'discountRate'
  ]),
  Vendor: Object.freeze([
    'vendorStatus',
    'vendorRating',
    'vendorContract',
    'preferredPaymentMethod',
    'taxId'
  ]),
  Distributor: Object.freeze(['channelRegion', 'distributionTerritory', 'distributionCapacityMonthly']),
  Dealer: Object.freeze(['dealerLevel', 'terms', 'shippingAddress', 'logisticsPartner'])
});

function normalizeFieldKey(key) {
  return String(key ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function platformDefaultFieldsForType(type) {
  const t = String(type ?? '').trim();
  if (!t) return [];
  if (ORGANIZATION_TYPE_FIELDS[t]) return [...ORGANIZATION_TYPE_FIELDS[t]];
  const match = Object.keys(ORGANIZATION_TYPE_FIELDS).find((k) => k.toLowerCase() === t.toLowerCase());
  return match ? [...ORGANIZATION_TYPE_FIELDS[match]] : [];
}

function getOrganizationTypeScopedFieldPool() {
  const pool = new Set();
  for (const fields of Object.values(ORGANIZATION_TYPE_FIELDS)) {
    for (const f of fields) pool.add(f);
  }
  return [...pool];
}

/** Removed from product; strip from tenant catalogs and picklists. */
const RETIRED_ORGANIZATION_TYPE_VALUES = Object.freeze(['Distributor', 'Dealer']);

function isRetiredOrganizationType(value) {
  const v = String(value ?? '').trim().toLowerCase();
  return RETIRED_ORGANIZATION_TYPE_VALUES.some((type) => type.toLowerCase() === v);
}

function picklistOptionValue(option) {
  if (option == null) return '';
  if (typeof option === 'object') return String(option.value ?? option.label ?? '').trim();
  return String(option).trim();
}

function stripRetiredOrganizationTypesFromModuleFields(fields) {
  if (!Array.isArray(fields)) return { fields, removed: false };
  let removed = false;
  const next = fields.map((field) => {
    if (String(field?.key || '').toLowerCase() !== 'types') return field;
    const options = Array.isArray(field.options) ? field.options : [];
    const enumVals = Array.isArray(field.enum) ? field.enum : [];
    const filteredOptions = options.filter(
      (opt) => !isRetiredOrganizationType(picklistOptionValue(opt))
    );
    const filteredEnum = enumVals.filter(
      (opt) => !isRetiredOrganizationType(picklistOptionValue(opt))
    );
    if (filteredOptions.length === options.length && filteredEnum.length === enumVals.length) {
      return field;
    }
    removed = true;
    const out = { ...field };
    if (options.length) out.options = filteredOptions;
    if (enumVals.length) out.enum = filteredEnum;
    return out;
  });
  return { fields: next, removed };
}

module.exports = {
  ORGANIZATION_ALWAYS_VISIBLE_FIELD_KEYS,
  ORGANIZATION_TYPE_FIELDS,
  RETIRED_ORGANIZATION_TYPE_VALUES,
  normalizeFieldKey,
  platformDefaultFieldsForType,
  getOrganizationTypeScopedFieldPool,
  isRetiredOrganizationType,
  stripRetiredOrganizationTypesFromModuleFields,
};
