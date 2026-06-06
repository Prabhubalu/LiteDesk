/**
 * Feature flag for inline column-header filters in list table view.
 * When false, ListView and TableView behave exactly as before.
 */
export const ENABLE_COLUMN_HEADER_FILTERS = true;

export function isColumnHeaderFiltersEnabled(): boolean {
  return ENABLE_COLUMN_HEADER_FILTERS;
}
