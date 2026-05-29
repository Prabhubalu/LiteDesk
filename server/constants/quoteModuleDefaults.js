/**
 * Bootstrap defaults for platform.quotes ModuleDefinition (seed/migration/ensure only).
 *
 * After install, Quick Create and required flags are owned by:
 * Settings → Core Modules → Quotes (ModuleDefinition.quickCreate + field.required).
 *
 * Keep INITIAL_QUOTE_QUICK_CREATE aligned with allowOnCreate fields in
 * client/src/platform/fields/quoteFieldModel.ts.
 */

/** Fields shown in New Quote quick create on a fresh instance. */
const INITIAL_QUOTE_QUICK_CREATE = [
  'quoteTitle',
  'quoteDate',
  'validUntil',
  'currency',
  'contactId',
  'organizationRefId',
  'dealId',
  'ownerId'
];

/**
 * Fields marked required in Field Configurations on a fresh instance.
 * Keep minimal — relationships and dates stay optional by default.
 */
const INITIAL_QUOTE_REQUIRED_FIELDS = [
  'quoteTitle'
];

const INITIAL_QUOTE_REQUIRED_SET = new Set(
  INITIAL_QUOTE_REQUIRED_FIELDS.map((k) => String(k).toLowerCase())
);

/**
 * Apply bootstrap required flags to module field definitions (migration/ensure).
 * Does not remove required when already set to false by tenant settings.
 */
function applyQuoteModuleFieldDefaults(fields) {
  if (!Array.isArray(fields)) return fields;
  return fields.map((field) => {
    const key = String(field?.key || '').toLowerCase();
    if (!INITIAL_QUOTE_REQUIRED_SET.has(key)) return field;
    if (field.required === false) return field;
    return { ...field, required: true };
  });
}

function isInitialQuoteRequiredField(fieldKey) {
  return INITIAL_QUOTE_REQUIRED_SET.has(String(fieldKey || '').toLowerCase());
}

module.exports = {
  INITIAL_QUOTE_QUICK_CREATE,
  INITIAL_QUOTE_REQUIRED_FIELDS,
  applyQuoteModuleFieldDefaults,
  isInitialQuoteRequiredField
};
