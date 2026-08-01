/**
 * Bootstrap defaults for Organizations module (seed/migration/ensure only).
 *
 * After install, Quick Create is owned by:
 * Settings → Organizations → Quick Create (ModuleDefinition.quickCreate).
 *
 * Keep INITIAL_ORGANIZATION_QUICK_CREATE aligned with ORGANIZATION_QUICK_CREATE_DEFAULT in
 * client/src/platform/fields/organizationFieldModel.ts.
 *
 * App participation roles are configured via OrganizationParticipationSection;
 * `types[]` is the denormalized union (system-derived), not a QC field.
 */

/** Fields shown in New Organization quick create on a fresh instance. */
const INITIAL_ORGANIZATION_QUICK_CREATE = [
  'name',
  'industry',
  'phone',
  'website',
  'assignedTo',
];

/**
 * Default key fields for Organizations on a fresh instance.
 * Keep aligned with ORGANIZATION_DEFAULT_KEY_FIELDS in
 * client/src/platform/fields/organizationFieldModel.ts.
 */
const INITIAL_ORGANIZATION_KEY_FIELDS = [
  'types',
  'derivedStatus',
  'industry',
  'phone',
  'annualRevenue',
  'assignedTo',
];

module.exports = {
  INITIAL_ORGANIZATION_QUICK_CREATE,
  INITIAL_ORGANIZATION_KEY_FIELDS,
};
