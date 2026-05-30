/** Recommended CSV column headers per import entity (API field keys). */
const RECOMMENDED_HEADERS = {
  Contacts: ['first_name', 'last_name', 'email', 'phone', 'company', 'sales_type', 'source'],
  Deals: ['name', 'amount', 'stage', 'status', 'expected_close_date'],
  Tasks: ['title', 'description', 'status', 'priority', 'due_date'],
  Organizations: ['name', 'industry', 'website', 'phone', 'email'],
};

/**
 * Build a minimal CSV template string for the given entity and available fields.
 * @param {string} entityType
 * @param {{ value: string, label: string }[]} fields
 */
export function buildImportTemplateCsv(entityType, fields = []) {
  const fieldKeys = new Set(fields.map((f) => f.value));
  const recommended = (RECOMMENDED_HEADERS[entityType] || []).filter((key) => fieldKeys.has(key));
  const headers = recommended.length > 0 ? recommended : fields.slice(0, 8).map((f) => f.value);
  if (!headers.length) return 'column_1,column_2\n';
  return `${headers.join(',')}\n`;
}

/**
 * Trigger a browser download of a CSV import template.
 * @param {string} entityType
 * @param {{ value: string, label: string }[]} fields
 */
export function downloadImportTemplate(entityType, fields = []) {
  const csv = buildImportTemplateCsv(entityType, fields);
  const slug = String(entityType || 'import').toLowerCase();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slug}_import_template.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Format byte size for display in the upload step.
 * @param {number} bytes
 */
export function formatImportFileSize(bytes) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
