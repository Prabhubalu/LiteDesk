import appRouter from '@/router';
import { getNotificationRoute, validateRoute } from '@/utils/notificationRouteMap';

/**
 * Resolve a tab path for a notification entity, or null when unavailable.
 *
 * @param {string} appKey
 * @param {{ type?: string, id?: string, title?: string, name?: string, caseId?: string }} entity
 * @returns {string|null}
 */
export function getNotificationPath(appKey, entity) {
  const route = getNotificationRoute(appKey, entity);
  if (!route || !validateRoute(appRouter, route)) {
    return null;
  }
  try {
    return appRouter.resolve(route).path;
  } catch {
    return null;
  }
}

/**
 * @param {{ title?: string, name?: string, caseId?: string }} [entity]
 */
export function buildNotificationOpenTabOptions(entity) {
  const recordName = entity?.title || entity?.name || entity?.caseId;
  return recordName
    ? { title: recordName, params: { name: recordName }, insertAdjacent: true }
    : { insertAdjacent: true };
}

/**
 * @param {string} appKey
 * @param {{ type?: string, id?: string, title?: string, name?: string, caseId?: string }} entity
 * @returns {boolean}
 */
export function canNavigateFromNotification(appKey, entity) {
  return !!getNotificationPath(appKey, entity);
}
