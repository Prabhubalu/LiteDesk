/**
 * Server-side filter parity registry.
 * Fields not listed for a module fall back to metadata filterable (legacy modules).
 * Explicit sets gate inline exposure for audited modules.
 */
const SUPPORTED_BY_MODULE: Record<string, ReadonlySet<string>> = {
  people: new Set(['name', 'assignedTo', 'organization', 'sales_type', 'helpdesk_role', 'email', 'phone']),
  tasks: new Set(['status', 'priority', 'assignedTo', 'dueDate', 'createdAt', 'projectId', 'contactId', 'organizationId']),
  deals: new Set(['stage', 'status', 'priority', 'assignedTo', 'contactId', 'accountId', 'pipeline', 'expectedCloseDate', 'createdAt']),
  organizations: new Set(['assignedTo', 'type', 'industry', 'email', 'createdAt']),
  events: new Set(['eventType', 'status', 'assignedTo', 'startDateTime', 'endDateTime']),
  items: new Set(['status', 'itemType', 'category', 'createdAt']),
  quotes: new Set(['status', 'assignedTo', 'validUntil', 'quoteDate', 'createdAt']),
  sales_orders: new Set(['status', 'assignedTo', 'fulfillmentStatus', 'sourceType', 'orderDate', 'createdAt']),
  invoices: new Set(['status', 'assignedTo', 'sourceType', 'invoiceDate', 'createdAt']),
  cases: new Set(['status', 'priority', 'caseType', 'channel', 'assignedTo', 'createdAt']),
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
