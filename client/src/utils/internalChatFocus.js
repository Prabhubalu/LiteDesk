/**
 * Tracks which Internal Chat space the user is actively viewing
 * so toast/sound can be suppressed for that conversation.
 */

let activeSpaceId = null;
let chatRouteActive = false;

/**
 * @param {{ spaceId?: string|null, routeActive?: boolean }} opts
 */
export function setInternalChatFocus({ spaceId = null, routeActive = false } = {}) {
  activeSpaceId = spaceId ? String(spaceId) : null;
  chatRouteActive = Boolean(routeActive);
}

export function clearInternalChatFocus() {
  activeSpaceId = null;
  chatRouteActive = false;
}

/**
 * True when the user is looking at this space in an active Chat tab (tab visible).
 * @param {string|null|undefined} spaceId
 */
export function isViewingInternalChatSpace(spaceId) {
  if (!spaceId) return false;
  if (typeof document !== 'undefined' && document.hidden) return false;
  if (!chatRouteActive) return false;
  return String(activeSpaceId || '') === String(spaceId);
}

export function getInternalChatFocusedSpaceId() {
  return activeSpaceId;
}
