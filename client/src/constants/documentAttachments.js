/**
 * Modules that support document attachments (Phase 2).
 */
export const DOCUMENT_ATTACHMENT_MODULES = new Set([
  'people',
  'organizations',
  'deals',
  'tasks',
  'events',
  'forms',
  'cases',
  'quotes',
  'items'
]);

/** Stable relationship keys for record → documents links (server-aligned). */
export const RELATIONSHIP_KEY_BY_MODULE = Object.freeze({
  people: 'people_documents',
  organizations: 'organizations_documents',
  deals: 'deal_documents',
  tasks: 'task_documents',
  events: 'event_documents',
  forms: 'form_documents',
  cases: 'case_documents',
  quotes: 'quote_documents',
  items: 'item_documents'
});

export function supportsDocumentAttachments(moduleKey) {
  return DOCUMENT_ATTACHMENT_MODULES.has(String(moduleKey || '').toLowerCase().trim());
}

export function resolveDocumentRelationshipKey(moduleKey) {
  const key = String(moduleKey || '').toLowerCase().trim();
  return RELATIONSHIP_KEY_BY_MODULE[key] || null;
}
