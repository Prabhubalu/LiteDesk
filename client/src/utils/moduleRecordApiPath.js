import { getModuleListConfig } from '@/platform/modules/moduleListRegistry';

/**
 * REST path segment for record CRUD (apiClient prefixes `/api`).
 * Helpdesk cases are mounted at `/api/helpdesk/cases`, not `/api/cases`.
 * Prefer registry apiEndpoint when present (e.g. sales_orders → /sales-orders).
 */
export function getModuleRecordCrudPathBase(moduleKey, options = {}) {
  const mk = String(moduleKey || '').toLowerCase().trim();
  const appKey = String(options.appKey || '').toUpperCase();
  const routePath = String(options.routePath || '').toLowerCase();
  if (mk === 'cases' && (appKey === 'HELPDESK' || routePath.startsWith('/helpdesk/'))) {
    return '/helpdesk/cases';
  }
  const endpoint = getModuleListConfig(mk)?.apiEndpoint;
  if (endpoint) {
    return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  }
  return `/${mk}`;
}
