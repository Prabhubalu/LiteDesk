/**
 * Bootstrap defaults for Deals module (seed/migration/ensure only).
 *
 * After install, Quick Create is owned by:
 * Settings → Deals → Quick Create (ModuleDefinition.quickCreate).
 *
 * Keep INITIAL_DEALS_QUICK_CREATE aligned with DEAL_QUICK_CREATE_DEFAULT in
 * client/src/platform/fields/dealFieldModel.ts.
 */

/** Fields shown in New Deal quick create on a fresh instance. */
const INITIAL_DEALS_QUICK_CREATE = [
  'name',
  'accountId',
  'pipeline',
  'stage',
  'expectedCloseDate',
  'amount',
  'assignedTo',
];

module.exports = {
  INITIAL_DEALS_QUICK_CREATE,
};
