/** Client mirror of server/constants/catalogLifecycle.js — keep in sync. */
/** @see docs/CATALOG_ROADMAP.md */

export const CATALOG_LIFECYCLE_STATES = ['Draft', 'Active', 'Discontinued', 'Archived'];

export const CATALOG_LIFECYCLE_TRANSITIONS = {
  Draft: ['Active', 'Archived'],
  Active: ['Discontinued', 'Archived'],
  Discontinued: ['Active', 'Archived'],
  Archived: []
};

export const CATALOG_LIFECYCLE_DEFAULT = 'Active';

export const CATALOG_SELLABLE_LIFECYCLE_STATES = ['Active'];

export function isCatalogLifecycleState(value) {
  return CATALOG_LIFECYCLE_STATES.includes(value);
}

export function isCatalogItemSellable(lifecycleState) {
  return lifecycleState === 'Active';
}

export function getAllowedCatalogLifecycleTransitions(currentState) {
  return CATALOG_LIFECYCLE_TRANSITIONS[currentState] || [];
}

export function canTransitionCatalogLifecycle(fromState, toState) {
  if (!isCatalogLifecycleState(fromState) || !isCatalogLifecycleState(toState)) {
    return false;
  }
  if (fromState === toState) {
    return true;
  }
  return getAllowedCatalogLifecycleTransitions(fromState).includes(toState);
}

export function syncLegacyItemStatusFromLifecycle(lifecycleState) {
  return lifecycleState === 'Active' ? 'Active' : 'Inactive';
}

export function inferLifecycleStateFromLegacyStatus(status, lifecycleState) {
  if (lifecycleState && isCatalogLifecycleState(lifecycleState)) {
    return lifecycleState;
  }
  if (status === 'Inactive') {
    return 'Discontinued';
  }
  return CATALOG_LIFECYCLE_DEFAULT;
}

/** i18n keys under platform.* for lifecycle state labels */
export const CATALOG_LIFECYCLE_LABEL_KEYS = {
  Draft: 'platform.catalogLifecycleDraft',
  Active: 'platform.catalogLifecycleActive',
  Discontinued: 'platform.catalogLifecycleDiscontinued',
  Archived: 'platform.catalogLifecycleArchived'
};
