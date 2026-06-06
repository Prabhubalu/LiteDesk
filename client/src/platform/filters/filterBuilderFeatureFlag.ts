/**
 * Feature flag for the advanced Filter Builder popover (Phase 0).
 * When true, legacy toolbar filter dropdowns are hidden.
 */
export const ENABLE_FILTER_BUILDER = true;

export function isFilterBuilderEnabled(): boolean {
  return ENABLE_FILTER_BUILDER;
}
