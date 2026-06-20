/**
 * ============================================================================
 * PLATFORM CORE: Dynamic Route Loader (Phase 0D)
 * ============================================================================
 * 
 * This utility converts backend route definitions into Vue Router routes.
 * Routes are loaded from the UI composition API and can be injected at runtime.
 * 
 * Supports:
 * - List view routes
 * - Detail view routes
 * - Create view routes
 * 
 * See PLATFORM_ARCHITECTURE.md for details.
 * ============================================================================
 */

import { useAppShellStore } from '@/stores/appShell';

/**
 * Component mapping for known modules
 * This maps module keys to their Vue components
 */
const componentMap = {
  // CRM Modules
  people: () => import('@/views/People.vue'),
  contacts: () => import('@/views/People.vue'),
  'people-create': () => import('@/views/PeopleCreate.vue'),
  'person-detail': () => import('@/pages/ModuleRecordPage.vue'),
  organizations: () => import('@/views/Organizations.vue'),
  'organization-detail': () => import('@/pages/ModuleRecordPage.vue'),
  deals: () => import('@/views/Deals.vue'),
  'deal-detail': () => import('@/views/DealDetail.vue'),
  tasks: () => import('@/views/Tasks.vue'),
  'task-detail': () => import('@/pages/tasks/TaskRecordPage.vue'),
  events: () => import('@/views/Events.vue'),
  'event-detail': () => import('@/views/EventDetail.vue'),
  items: () => import('@/views/Items.vue'),
  'item-detail': () => import('@/pages/ModuleRecordPage.vue'),
  forms: () => import('@/views/Forms.vue'),
  'form-detail': () => import('@/views/FormDetail.vue'),
  imports: () => import('@/views/Imports.vue'),
  documents: () => import('@/views/Documents.vue'),
  'import-detail': () => import('@/views/ImportDetail.vue'),
  responses: () => import('@/views/Responses.vue'),
  'response-detail': () => import('@/views/FormResponseDetail.vue'),
  
  // Default fallback
  default: () => import('@/views/Dashboard.vue')
};

/**
 * Get component for a route based on module key and type
 */
function getComponent(moduleKey, type) {
  const key = type === 'detail' 
    ? `${moduleKey}-detail` 
    : type === 'create'
    ? `${moduleKey}-create`
    : moduleKey;
  
  return componentMap[key] || componentMap.default;
}

/**
 * Convert backend route definition to Vue Router route
 */
export function convertToVueRoute(routeDef) {
  const { path, name, moduleKey, type, appKey } = routeDef;
  
  const route = {
    path,
    name,
    component: getComponent(moduleKey, type),
    meta: {
      requiresAuth: true,
      appKey,
      moduleKey,
      routeType: type
    }
  };

  // Add permission requirement for list and detail views
  if (type === 'list' || type === 'detail') {
    route.meta.requiresPermission = {
      module: moduleKey === 'people' ? 'contacts' : moduleKey,
      action: 'view'
    };
  }

  // Add create permission for create views
  if (type === 'create') {
    route.meta.requiresPermission = {
      module: moduleKey === 'people' ? 'contacts' : moduleKey,
      action: 'create'
    };
  }

  return route;
}

/**
 * Load dynamic routes from the app shell store
 * Returns an array of Vue Router route objects
 */
export function loadDynamicRoutes() {
  const appShellStore = useAppShellStore();
  const routeDefinitions = appShellStore.routes || [];
  
  return routeDefinitions.map(convertToVueRoute);
}

/**
 * Get routes for a specific app
 */
export function getRoutesForApp(appKey) {
  const appShellStore = useAppShellStore();
  const routeDefinitions = appShellStore.routes || [];
  
  return routeDefinitions
    .filter(route => route.appKey === appKey)
    .map(convertToVueRoute);
}

/**
 * Get routes for a specific module
 */
export function getRoutesForModule(moduleKey) {
  const appShellStore = useAppShellStore();
  const routeDefinitions = appShellStore.routes || [];
  
  return routeDefinitions
    .filter(route => route.moduleKey === moduleKey)
    .map(convertToVueRoute);
}

