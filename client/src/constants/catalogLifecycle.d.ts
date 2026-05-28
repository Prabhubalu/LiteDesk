declare module '@/constants/catalogLifecycle' {
  export const CATALOG_LIFECYCLE_STATES: string[];
  export const CATALOG_LIFECYCLE_TRANSITIONS: Record<string, string[]>;
  export const CATALOG_LIFECYCLE_DEFAULT: string;
  export const CATALOG_SELLABLE_LIFECYCLE_STATES: string[];

  export function isCatalogLifecycleState(value: string): boolean;
  export function isCatalogItemSellable(lifecycleState: string): boolean;
  export function getAllowedCatalogLifecycleTransitions(currentState: string): string[];
  export function canTransitionCatalogLifecycle(fromState: string, toState: string): boolean;
  export function syncLegacyItemStatusFromLifecycle(lifecycleState: string): string;
  export function inferLifecycleStateFromLegacyStatus(status: string, lifecycleState?: string): string;

  export const CATALOG_LIFECYCLE_LABEL_KEYS: Record<string, string>;
}

