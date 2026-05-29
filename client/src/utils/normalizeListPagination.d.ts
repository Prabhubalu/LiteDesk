export interface NormalizedListPagination {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  limit: number;
  hasMore: boolean;
}

export interface NormalizeListPaginationOptions {
  totalRecordsOverride?: number;
}

export function normalizeListPagination(
  source?: Record<string, unknown> | null,
  fallback?: Record<string, unknown>,
  options?: NormalizeListPaginationOptions
): NormalizedListPagination;
