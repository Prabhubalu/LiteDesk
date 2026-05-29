/**
 * Normalize list pagination from common API shapes.
 *
 * Supports:
 * - { currentPage, totalPages, totalRecords, limit }
 * - { page, total, limit }
 * - meta-style { page, total, limit }
 */
export function normalizeListPagination(source, fallback = {}, options = {}) {
  const pag = source && typeof source === 'object' ? source : {};
  const fb = fallback && typeof fallback === 'object' ? fallback : {};

  const limit = Math.max(1, Number(pag.limit ?? fb.limit) || 25);
  const currentPage = Math.max(
    1,
    Number(pag.currentPage ?? pag.page ?? fb.currentPage ?? fb.page) || 1
  );

  let totalRecords = Number(
    options.totalRecordsOverride ??
      pag.totalRecords ??
      pag.total ??
      fb.totalRecords ??
      fb.total ??
      0
  );
  if (!Number.isFinite(totalRecords) || totalRecords < 0) {
    totalRecords = 0;
  }

  let totalPages = Number(pag.totalPages ?? fb.totalPages);
  if (!Number.isFinite(totalPages) || totalPages < 1) {
    totalPages = totalRecords > 0 ? Math.ceil(totalRecords / limit) : 1;
  }

  const hasMore = currentPage < totalPages;

  return {
    currentPage,
    totalPages,
    totalRecords,
    limit,
    hasMore
  };
}
