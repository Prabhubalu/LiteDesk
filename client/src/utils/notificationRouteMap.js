/**
 * Centralized notification deep-link route mapping.
 * Maps appKey + entity.type to Vue Router route definitions.
 *
 * Entity types are normalized to uppercase for lookup. Backend may send
 * "Task", "Audit", "CorrectiveAction", etc. - all are handled.
 */

/**
 * Normalize entity type for route lookup.
 * Backend may send: "Task", "Audit", "CorrectiveAction", "Deal", etc.
 * Maps variations to canonical keys (e.g. CORRECTIVEACTION -> CORRECTIVE_ACTION).
 */
function normalizeEntityType(entityType) {
  const upper = String(entityType || '').toUpperCase().replace(/\s/g, '');
  const aliases = {
    CORRECTIVEACTION: 'CORRECTIVE_ACTION',
    CONTACT: 'PEOPLE',
    PERSON: 'PEOPLE'
  };
  return aliases[upper] || upper;
}

/**
 * Route map: appKey -> entityType -> route definition
 *
 * Route definitions can be:
 * - { name: 'route-name', params: { ... } } - named route with params
 * - { path: '/path/to/route' } - path-based route
 * - null - no route available
 */
const NOTIFICATION_ROUTE_MAP = {
  SALES: {
    TASK: (entityId) => ({
      name: 'task-detail',
      params: { id: entityId }
    }),
    EVENT: (entityId) => ({
      name: 'event-detail',
      params: { id: entityId }
    }),
    DEAL: (entityId) => ({
      name: 'deal-detail',
      params: { id: entityId }
    }),
    ORGANIZATION: (entityId) => ({
      name: 'organization-detail',
      params: { id: entityId }
    }),
    PEOPLE: (entityId) => ({
      name: 'person-detail',
      params: { id: entityId }
    }),
    ITEM: (entityId) => ({
      name: 'item-detail',
      params: { id: entityId }
    }),
  },

  AUDIT: {
    AUDIT: (entityId) => ({
      name: 'audit-detail',
      params: { eventId: entityId }
    }),
    EVENT: (entityId) => ({
      name: 'audit-detail',
      params: { eventId: entityId }
    }),
  },

  PORTAL: {
    AUDIT: (entityId) => ({
      name: 'portal-audit-detail',
      params: { eventId: entityId }
    }),
    EVENT: (entityId) => ({
      name: 'portal-audit-detail',
      params: { eventId: entityId }
    }),
    CORRECTIVE_ACTION: () => ({
      name: 'portal-actions'
    }),
  },

  HELPDESK: {
    CASE: (entityId) => ({
      path: `/helpdesk/cases/${entityId}`
    }),
  },
};

/**
 * Get route for a notification based on appKey and entity.
 * 
 * @param {string} appKey - 'SALES' | 'AUDIT' | 'PORTAL'
 * @param {Object} entity - { type: string, id: string }
 * @returns {Object|null} Route definition or null if no route available
 */
export function getNotificationRoute(appKey, entity) {
  if (!appKey || !entity || !entity.type || !entity.id) {
    return null;
  }

  const appRoutes = NOTIFICATION_ROUTE_MAP[appKey];
  if (!appRoutes) {
    console.warn(`[notificationRouteMap] Unknown appKey: ${appKey}`);
    return null;
  }

  // Normalize entity type (handles "Task", "Audit", "CorrectiveAction", etc.)
  const entityTypeKey = normalizeEntityType(entity.type);
  const routeBuilder = appRoutes[entityTypeKey];
  if (!routeBuilder || typeof routeBuilder !== 'function') {
    console.warn(`[notificationRouteMap] No route for appKey=${appKey}, entityType=${entityTypeKey}`);
    return null;
  }

  try {
    return routeBuilder(entity.id);
  } catch (err) {
    console.error(`[notificationRouteMap] Error building route:`, err);
    return null;
  }
}

/**
 * Validate that a route exists in the router.
 * This is a runtime check to prevent navigation errors.
 * 
 * @param {Object} router - Vue Router instance
 * @param {Object} route - Route definition from getNotificationRoute
 * @returns {boolean} True if route exists
 */
export function validateRoute(router, route) {
  if (!route || !router) return false;

  try {
    // Check if route name exists
    if (route.name) {
      const resolved = router.resolve({ name: route.name, params: route.params || {} });
      return resolved.name !== null;
    }
    
    // Check if path exists
    if (route.path) {
      const resolved = router.resolve(route.path);
      return resolved.name !== null || resolved.matched.length > 0;
    }
    
    return false;
  } catch (err) {
    console.warn(`[notificationRouteMap] Route validation error:`, err);
    return false;
  }
}

/**
 * Get all supported entity types for an app.
 * Useful for debugging or UI hints.
 * 
 * @param {string} appKey - 'SALES' | 'AUDIT' | 'PORTAL'
 * @returns {string[]} Array of supported entity types
 */
export function getSupportedEntityTypes(appKey) {
  const appRoutes = NOTIFICATION_ROUTE_MAP[appKey];
  if (!appRoutes) return [];
  return Object.keys(appRoutes);
}

export default {
  getNotificationRoute,
  validateRoute,
  getSupportedEntityTypes
};

