import type { PermissionSnapshot } from '@/types/permission-snapshot.types';
import { hasPermission as checkSnapshotPermission } from '@/types/permission-snapshot.types';

/**
 * Maps portal app sidebar module keys to RBAC permission keys.
 * Portal surfaces reuse core module permissions (cases, documents, etc.).
 */
const PORTAL_KNOWLEDGE_MODULE_KEYS = new Set([
  'portal_knowledge',
  'knowledge',
  'documents',
  'portal_documents',
  'knowledge_base'
]);

const PORTAL_MODULE_PERMISSION_MAP: Record<string, string> = {
  portal_support: 'cases.read',
  support: 'cases.read',
  portal_knowledge: 'documents.read',
  knowledge: 'documents.read',
  documents: 'documents.read',
  portal_documents: 'documents.read',
  knowledge_base: 'documents.read',
  portal_invoices: 'invoices.read',
  invoices: 'invoices.read',
  portal_organization: 'organizations.read',
  organization: 'organizations.read',
  organizations: 'organizations.read',
  portal_people: 'people.read',
  people: 'people.read',
  portal_deals: 'deals.read',
  deals: 'deals.read',
  portal_audits: 'events.read',
  audits: 'events.read',
  portal_actions: 'events.read',
  actions: 'events.read',
  portal_forms: 'forms.read',
  forms: 'forms.read',
  portal_responses: 'responses.read',
  responses: 'responses.read'
};

/** RBAC module keys checked for each portal sidebar surface (matches server portalModuleAccess). */
const PORTAL_MODULE_RBAC_KEYS: Record<string, string[]> = {
  portal_support: ['cases'],
  support: ['cases'],
  portal_knowledge: ['documents'],
  knowledge: ['documents'],
  documents: ['documents'],
  portal_documents: ['documents'],
  knowledge_base: ['documents'],
  portal_invoices: ['invoices'],
  invoices: ['invoices'],
  portal_organization: ['organizations'],
  organization: ['organizations'],
  organizations: ['organizations'],
  portal_people: ['people', 'contacts'],
  people: ['people', 'contacts'],
  portal_deals: ['deals'],
  deals: ['deals'],
  portal_audits: ['events'],
  audits: ['events'],
  portal_actions: ['events'],
  actions: ['events'],
  portal_forms: ['forms'],
  forms: ['forms'],
  portal_responses: ['responses', 'forms'],
  responses: ['responses', 'forms']
};

function normalizePortalModuleKey(moduleKey: string): string {
  return String(moduleKey || '').toLowerCase().replace(/-/g, '_');
}

export function resolvePortalModulePermission(moduleKey: string): string | undefined {
  return PORTAL_MODULE_PERMISSION_MAP[normalizePortalModuleKey(moduleKey)];
}

export function isPortalKnowledgeModuleKey(moduleKey: string): boolean {
  return PORTAL_KNOWLEDGE_MODULE_KEYS.has(normalizePortalModuleKey(moduleKey));
}

function moduleReadGranted(snapshot: PermissionSnapshot, moduleKeys: string[]): boolean {
  return moduleKeys.some((mod) => checkSnapshotPermission(snapshot, `${mod}.read`));
}

/**
 * Portal sidebar grant check — aligned with server portalModuleAccess envelope semantics.
 */
export function hasPortalModuleAccess(
  snapshot: PermissionSnapshot,
  portalModuleKey: string
): boolean {
  const normalized = normalizePortalModuleKey(portalModuleKey);
  const rbacModules = PORTAL_MODULE_RBAC_KEYS[normalized];
  if (!rbacModules?.length) {
    const permission = resolvePortalModulePermission(portalModuleKey);
    return permission ? checkSnapshotPermission(snapshot, permission) : false;
  }
  return moduleReadGranted(snapshot, rbacModules);
}
