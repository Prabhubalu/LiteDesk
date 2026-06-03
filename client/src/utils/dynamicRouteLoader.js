/**
 * ============================================================================
 * PLATFORM UI SHELL: Dynamic Route Loader (Phase 1A)
 * ============================================================================
 * 
 * Consumes /api/ui/routes and registers routes dynamically in Vue Router.
 * 
 * Supports:
 * - List routes
 * - Detail routes  
 * - Create routes
 * 
 * Lazy loads views and gracefully skips unknown modules.
 * 
 * ============================================================================
 */

/**
 * Map module key to view component name
 * Handles special cases and naming conventions
 */
function getViewComponentName(moduleKey, type) {
  // Normalize module key
  const normalized = moduleKey.toLowerCase();
  
  // Special mappings
  const specialMappings = {
    'contacts': 'people',
    'people': 'people'
  };
  
  const baseModule = specialMappings[normalized] || normalized;
  
  // Capitalize first letter for component name
  const capitalized = baseModule.charAt(0).toUpperCase() + baseModule.slice(1);
  
  // Handle pluralization for list views
  const pluralMap = {
    'people': 'People',
    'organizations': 'Organizations',
    'deals': 'Deals',
    'tasks': 'Tasks',
    'events': 'Events',
    'items': 'Items',
    'forms': 'Forms',
    'imports': 'Imports',
    'groups': 'Groups'
  };
  
  if (type === 'list') {
    return pluralMap[baseModule] || capitalized;
  } else if (type === 'detail') {
    return `${capitalized}Detail`;
  } else if (type === 'create') {
    // Create views might not exist for all modules, fallback to list
    return pluralMap[baseModule] || capitalized;
  }
  
  return capitalized;
}

/** Known module keys with dedicated list views. Custom/unknown modules use GenericModule for list. */
const KNOWN_MODULE_KEYS = new Set([
  'people', 'contacts', 'organizations', 'deals', 'quotes', 'sales-orders', 'tasks', 'events', 'items', 'forms',
  'imports', 'groups', 'responses'
]);

/**
 * Get lazy-loaded component for a route.
 * - Detail routes: always use ModuleRecordPage so any new/custom module gets the standard record page.
 * - List/Create routes: use dedicated view for known modules, GenericModule for custom/unknown.
 */
function getLazyComponent(moduleKey, type) {
  const normalizedKey = (moduleKey || '').toLowerCase();

  if (type === 'detail') {
    return () => import('@/pages/ModuleRecordPage.vue');
  }

  const useGeneric = !KNOWN_MODULE_KEYS.has(normalizedKey);
  if (useGeneric) {
    return () => import('@/views/GenericModule.vue');
  }

  const componentName = getViewComponentName(moduleKey, type);
  return () => {
    return import(`@/views/${componentName}.vue`)
      .catch(error => {
        console.warn(`[DynamicRouteLoader] View not found: ${componentName}.vue for module ${moduleKey} (${type})`, error);
        return import('@/views/GenericModule.vue');
      });
  };
}

/**
 * Convert route definition from API to Vue Router route config
 */
function convertToVueRoute(routeDef) {
  const { path, name, moduleKey, type, appKey } = routeDef;
  
  // Skip CONTROL_PLANE routes - platform-only, never for tenants
  if (appKey?.toUpperCase() === 'CONTROL_PLANE') {
    return null;
  }
  
  const route = {
    path,
    name,
    component: getLazyComponent(moduleKey, type),
    meta: {
      requiresAuth: true,
      moduleKey,
      appKey,
      routeType: type
    }
  };
  
  // Add permission requirement for list and detail routes
  if (type === 'list' || type === 'detail') {
    route.meta.requiresPermission = {
      module: moduleKey === 'people' ? 'people' : moduleKey,
      action: 'view'
    };
  } else if (type === 'create') {
    route.meta.requiresPermission = {
      module: moduleKey === 'people' ? 'people' : moduleKey,
      action: 'create'
    };
  }
  
  return route;
}

/**
 * Register dynamic routes from /api/ui/routes
 * @param {Router} router - Vue Router instance
 * @param {Array} routeDefinitions - Route definitions from API
 */
export function registerDynamicRoutes(router, routeDefinitions) {
  if (!routeDefinitions || !Array.isArray(routeDefinitions)) {
    console.warn('[DynamicRouteLoader] No route definitions provided');
    return;
  }
  
  const routesToAdd = [];
  const existingRouteNames = new Set(router.getRoutes().map(r => r.name));
  
  for (const routeDef of routeDefinitions) {
    // Skip if route already exists
    if (existingRouteNames.has(routeDef.name)) {
      console.log(`[DynamicRouteLoader] Route ${routeDef.name} already exists, skipping`);
      continue;
    }
    
    // Skip CONTROL_PLANE routes
    if (routeDef.appKey?.toUpperCase() === 'CONTROL_PLANE') {
      console.log(`[DynamicRouteLoader] Skipping CONTROL_PLANE route: ${routeDef.name}`);
      continue;
    }
    
    const vueRoute = convertToVueRoute(routeDef);
    if (vueRoute) {
      routesToAdd.push(vueRoute);
    }
  }
  
  if (routesToAdd.length > 0) {
    console.log(`[DynamicRouteLoader] Registering ${routesToAdd.length} dynamic routes`);
    routesToAdd.forEach(route => {
      router.addRoute(route);
      console.log(`[DynamicRouteLoader] ✅ Registered route: ${route.name} (${route.path})`);
    });
  } else {
    console.log('[DynamicRouteLoader] No new routes to register');
  }
}

/**
 * Load routes from /api/ui/routes and register them
 * @param {Router} router - Vue Router instance
 * @param {Function|null} apiClient - API client function
 * @param {Array|null} preloadedRoutes - Optional routes already fetched during UI bootstrap
 */
export async function loadAndRegisterRoutes(router, apiClient, preloadedRoutes = null) {
  try {
    let routePayload = preloadedRoutes;
    if (!routePayload) {
      const response = await apiClient('/ui/routes');
      if (response.success && response.data) {
        routePayload = response.data;
      } else {
        console.warn('[DynamicRouteLoader] Failed to load routes:', response);
        return false;
      }
    }

    if (routePayload?.length) {
      registerDynamicRoutes(router, routePayload);
      return true;
    }

    console.warn('[DynamicRouteLoader] No routes available to register');
    return false;
  } catch (error) {
    console.error('[DynamicRouteLoader] Error loading routes:', error);
    return false;
  }
}

