/** Resolve CRM module detail route for assistant open_record actions. */
export function resolveModuleRecordRoute(moduleKey: string, recordId: string): { name?: string; path?: string; params?: Record<string, string> } | null {
  const id = String(recordId || '').trim();
  const key = String(moduleKey || '').trim().toLowerCase();
  if (!id || !key) return null;

  const byName: Record<string, string> = {
    people: 'person-detail',
    deals: 'deal-detail',
    tasks: 'task-detail',
    events: 'event-detail',
    quotes: 'quote-detail',
    organizations: 'organization-detail',
    cases: 'helpdesk-cases-detail',
    items: 'item-detail',
  };

  const name = byName[key];
  if (name) return { name, params: { id } };

  // Do not invent `/${unknownModule}/${id}` paths (e.g. analytics_reports → empty page).
  return null;
}
