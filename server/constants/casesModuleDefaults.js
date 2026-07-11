/**
 * Bootstrap defaults for Cases module (seed/migration/ensure only).
 *
 * After install, Quick Create is owned by:
 * Settings → Cases → Quick Create (ModuleDefinition.quickCreate).
 *
 * Keep INITIAL_CASES_QUICK_CREATE aligned with CASE_QUICK_CREATE_DEFAULT in
 * client/src/platform/fields/caseFieldModel.ts.
 */

/** Fields shown in New Case quick create on a fresh instance. */
const INITIAL_CASES_QUICK_CREATE = [
  'title',
  'contactId',
  'organizationRefId',
  'caseType',
  'priority',
  'status',
  'assignedTo',
];

/**
 * Fields marked required in Field Configurations on a fresh instance
 * beyond schema-required (title, assignedTo, caseType, priority, status).
 */
const INITIAL_CASES_REQUIRED_FIELDS = [
  'contactId',
];

/**
 * Server-managed / AI / portal / SLA keys excluded from module base fields
 * and stripped from saved ModuleDefinition overrides (never in create/edit).
 * Keys are stored lowercase for case-insensitive matching.
 */
const CASES_FORM_EXCLUDED_FIELD_KEYS = [
  'activities',
  'slacycles',
  'currentslacycle',
  'assignmentcontrol',
  'reopencount',
  'customfields',
  'portalreadreceipts',
  'portalcsat',
  'conversationcount',
  'mergeparentcaseid',
  'duplicateflag',
  'sourcemessageid',
  'threadid',
  'sentiment',
  'aisummary',
  'suggestedresolution',
  'categoryconfidencescore',
  'autoclassification',
  'slapolicykey',
  'firstresponsedueat',
  'resolutiondueat',
  'slastatus',
  'slabreached',
  'businesshourscalendarid',
  'lastslaeventat',
  'lastcustomerreplyat',
  'lastagentreplyat',
  'resolvedby',
  'resolvedat',
  'responsemetat',
];

const INITIAL_CASES_REQUIRED_SET = new Set(
  INITIAL_CASES_REQUIRED_FIELDS.map((k) => String(k).toLowerCase())
);

const CASES_FORM_EXCLUDED_SET = new Set(CASES_FORM_EXCLUDED_FIELD_KEYS);

function isInitialCaseRequiredField(fieldKey) {
  return INITIAL_CASES_REQUIRED_SET.has(String(fieldKey || '').toLowerCase());
}

function isCasesFormExcludedField(fieldKey) {
  return CASES_FORM_EXCLUDED_SET.has(String(fieldKey || '').toLowerCase());
}

module.exports = {
  INITIAL_CASES_QUICK_CREATE,
  INITIAL_CASES_REQUIRED_FIELDS,
  CASES_FORM_EXCLUDED_FIELD_KEYS,
  isInitialCaseRequiredField,
  isCasesFormExcludedField,
};
