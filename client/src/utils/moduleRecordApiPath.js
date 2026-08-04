import { getModuleListConfig } from '@/platform/modules/moduleListRegistry';

/** Non-registry modules that still need a correct REST path for DynamicForm lookups. */
const LOOKUP_CRUD_PATH_OVERRIDES = Object.freeze({
  inventory_locations: '/inventory/locations',
  inventorylocations: '/inventory/locations',
  stockrooms: '/inventory/locations',
  stock_adjustments: '/inventory/adjustments',
  stockadjustments: '/inventory/adjustments',
  stock_transfers: '/inventory/transfers',
  stocktransfers: '/inventory/transfers'
});

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
  const override = LOOKUP_CRUD_PATH_OVERRIDES[mk];
  if (override) return override;
  const endpoint = getModuleListConfig(mk)?.apiEndpoint;
  if (endpoint) {
    return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  }
  return `/${mk}`;
}

/**
 * In-app record detail route (Vue router path, not REST).
 * Organizations use /v2/organization for API but /organizations in the router.
 * Stockrooms use /inventory/locations API but /inventory/stockrooms in the router.
 * Stock adjustments use /inventory/adjustments API and router path.
 */
export function getModuleRecordRoutePathBase(moduleKey, options = {}) {
  const mk = String(moduleKey || '').toLowerCase().trim();
  if (mk === 'organizations' || mk === 'organization') {
    return '/organizations';
  }
  if (mk === 'stockrooms') {
    return '/inventory/stockrooms';
  }
  if (mk === 'stock_adjustments') {
    return '/inventory/adjustments';
  }
  if (mk === 'stock_transfers') {
    return '/inventory/transfers';
  }
  return getModuleRecordCrudPathBase(moduleKey, options);
}

/**
 * Full in-app path to a record detail page (Vue router path, not REST).
 */
export function getModuleRecordDetailPath(moduleKey, recordId, options = {}) {
  const id = String(recordId || '').trim();
  const base = getModuleRecordRoutePathBase(moduleKey, options);
  if (!id) return base;
  const mk = String(moduleKey || '').toLowerCase().trim();
  if (mk === 'forms') {
    return `${base}/${id}/detail`;
  }
  return `${base}/${id}`;
}
