/**
 * Server-side filter parity registry.
 * Fields not listed for a module fall back to metadata filterable (legacy modules).
 * Explicit sets gate inline exposure for audited modules.
 */
const SUPPORTED_BY_MODULE: Record<string, ReadonlySet<string>> = {
  people: new Set(['name', 'assignedTo', 'organization', 'sales_type', 'helpdesk_role', 'email', 'phone']),
  tasks: new Set(['status', 'priority', 'assignedTo', 'dueDate', 'projectId', 'contactId', 'organizationId']),
  deals: new Set(['stage', 'status', 'priority', 'ownerId', 'contactId', 'accountId', 'pipeline']),
  organizations: new Set(['assignedTo', 'type', 'industry', 'email']),
  events: new Set(['eventType', 'status', 'eventOwnerId', 'startDateTime']),
  items: new Set(['status', 'itemType', 'category']),
  quotes: new Set(['status', 'ownerId', 'validUntil']),
  sales_orders: new Set(['status', 'ownerId', 'fulfillmentStatus', 'sourceType']),
  invoices: new Set(['status', 'ownerId', 'sourceType']),
  cases: new Set(['status', 'priority', 'caseType', 'channel', 'caseOwnerId']),
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
