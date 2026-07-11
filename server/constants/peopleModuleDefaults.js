/**
 * Bootstrap defaults for People module (seed/migration/ensure only).
 *
 * After install, Quick Create is owned by:
 * Settings → People → Quick Create (ModuleDefinition.quickCreate).
 *
 * Keep INITIAL_PEOPLE_QUICK_CREATE aligned with PEOPLE_QUICK_CREATE_DEFAULT in
 * client/src/platform/fields/peopleFieldModel.ts.
 *
 * App Participation is always shown as a separate drawer section — not in quickCreate.
 * assignedTo is required via recordCreateOwnerDefaults (applyOwnerFieldRequiredToModuleFields).
 */

/** Fields shown in New Person quick create on a fresh instance. */
const INITIAL_PEOPLE_QUICK_CREATE = [
  'first_name',
  'last_name',
  'email',
  'mobile',
  'organization',
  'assignedTo',
];

module.exports = {
  INITIAL_PEOPLE_QUICK_CREATE,
};
