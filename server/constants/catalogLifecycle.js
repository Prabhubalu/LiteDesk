/**
 * Catalog lifecycle contract for Items (parent catalog records).
 * Canonical sellability gate before Quotes / Orders / Invoices exist.
 *
 * @see docs/CATALOG_ROADMAP.md
 */

const CATALOG_LIFECYCLE_STATES = ['Draft', 'Active', 'Discontinued', 'Archived'];

/** Allowed transitions (from → to[]). Empty array = terminal for forward edits. */
const CATALOG_LIFECYCLE_TRANSITIONS = {
  Draft: ['Active', 'Archived'],
  Active: ['Discontinued', 'Archived'],
  Discontinued: ['Active', 'Archived'],
  Archived: []
};

const CATALOG_LIFECYCLE_DEFAULT = 'Active';

/** States selectable on future quote/order line pickers. */
const CATALOG_SELLABLE_LIFECYCLE_STATES = ['Active'];

function isCatalogLifecycleState(value) {
  return CATALOG_LIFECYCLE_STATES.includes(value);
}

function isCatalogItemSellable(lifecycleState) {
  return lifecycleState === 'Active';
}

function getAllowedCatalogLifecycleTransitions(currentState) {
  return CATALOG_LIFECYCLE_TRANSITIONS[currentState] || [];
}

function canTransitionCatalogLifecycle(fromState, toState) {
  if (!isCatalogLifecycleState(fromState) || !isCatalogLifecycleState(toState)) {
    return false;
  }
  if (fromState === toState) {
    return true;
  }
  return getAllowedCatalogLifecycleTransitions(fromState).includes(toState);
}

/**
 * Sync legacy `status` (Active/Inactive) from canonical lifecycle_state.
 */
function syncLegacyItemStatusFromLifecycle(lifecycleState) {
  return lifecycleState === 'Active' ? 'Active' : 'Inactive';
}

/**
 * Infer lifecycle_state from legacy status when field is absent (read compat).
 */
function inferLifecycleStateFromLegacyStatus(status, lifecycleState) {
  if (lifecycleState && isCatalogLifecycleState(lifecycleState)) {
    return lifecycleState;
  }
  if (status === 'Inactive') {
    return 'Discontinued';
  }
  return CATALOG_LIFECYCLE_DEFAULT;
}

module.exports = {
  CATALOG_LIFECYCLE_STATES,
  CATALOG_LIFECYCLE_TRANSITIONS,
  CATALOG_LIFECYCLE_DEFAULT,
  CATALOG_SELLABLE_LIFECYCLE_STATES,
  isCatalogLifecycleState,
  isCatalogItemSellable,
  getAllowedCatalogLifecycleTransitions,
  canTransitionCatalogLifecycle,
  syncLegacyItemStatusFromLifecycle,
  inferLifecycleStateFromLegacyStatus
};
