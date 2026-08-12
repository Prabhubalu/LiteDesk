/**
 * Server-side filter parity registry.
 * Fields not listed for a module fall back to metadata filterable (legacy modules).
 * Explicit sets gate inline exposure for audited modules.
 */
const AUDIT_FILTER_KEYS = ['createdAt', 'updatedAt', 'createdBy'] as const;
const EVENT_AUDIT_FILTER_KEYS = ['createdTime', 'modifiedTime', 'createdBy'] as const;

const SUPPORTED_BY_MODULE: Record<string, ReadonlySet<string>> = {
  people: new Set(['name', 'assignedTo', 'organization', 'sales_type', 'helpdesk_role', 'email', 'phone', ...AUDIT_FILTER_KEYS]),
  tasks: new Set(['status', 'priority', 'assignedTo', 'dueDate', 'projectId', 'contactId', 'organizationId', ...AUDIT_FILTER_KEYS]),
  deals: new Set(['stage', 'status', 'priority', 'assignedTo', 'contactId', 'accountId', 'pipeline', 'expectedCloseDate', ...AUDIT_FILTER_KEYS]),
  organizations: new Set(['assignedTo', 'type', 'industry', 'email', ...AUDIT_FILTER_KEYS]),
  events: new Set(['eventType', 'status', 'assignedTo', 'startDateTime', 'endDateTime', ...EVENT_AUDIT_FILTER_KEYS]),
  items: new Set(['status', 'itemType', 'category', ...AUDIT_FILTER_KEYS]),
  quotes: new Set(['status', 'assignedTo', 'validUntil', 'quoteDate', ...AUDIT_FILTER_KEYS]),
  sales_orders: new Set(['status', 'assignedTo', 'fulfillmentStatus', 'sourceType', 'orderDate', ...AUDIT_FILTER_KEYS]),
  invoices: new Set(['status', 'assignedTo', 'sourceType', 'invoiceDate', ...AUDIT_FILTER_KEYS]),
  cases: new Set(['status', 'priority', 'caseType', 'channel', 'assignedTo', ...AUDIT_FILTER_KEYS]),
};

export function isFilterSupportedByServer(moduleKey: string, fieldKey: string): boolean {
  const module = String(moduleKey || '').toLowerCase();
  const key = String(fieldKey || '').trim();
  if (!module || !key) return false;

  const allowed = SUPPORTED_BY_MODULE[module];
  if (!allowed) return true;
  return allowed.has(key);
}

export function getSupportedFilterKeys(moduleKey: string): ReadonlySet<string> | null {
  const module = String(moduleKey || '').toLowerCase();
  return SUPPORTED_BY_MODULE[module] ?? null;
}
