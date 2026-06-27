export const BUILDER_DRAG_TYPES = {
  COMPONENT: 'application/x-arivu-builder-component',
  MERGE_TAG: 'application/x-arivu-builder-merge-tag'
};

/** Shared Sortable group for library → canvas component drops. */
export const BUILDER_COMPONENT_DRAG_GROUP = 'builder-components';

export const BUILDER_LIBRARY_DRAG_GROUP = {
  name: BUILDER_COMPONENT_DRAG_GROUP,
  pull: 'clone',
  put: false
};

/** Canvas lists: reorder/move blocks only — library uses HTML5 drop on containers. */
export const BUILDER_CANVAS_DRAG_GROUP = {
  name: BUILDER_COMPONENT_DRAG_GROUP,
  pull: true,
  put(to, from) {
    return from?.options?.group?.pull !== 'clone';
  }
};

export function isBuilderComponentDragEvent(event) {
  return dragEventHasType(event, BUILDER_DRAG_TYPES.COMPONENT)
    || dragEventHasType(event, 'text/plain');
}

/**
 * @param {DragEvent} event
 * @param {string} mimeType
 */
export function dragEventHasType(event, mimeType) {
  return Boolean(event.dataTransfer?.types?.includes(mimeType));
}

export function readBuilderDragPayload(event, mimeType) {
  const raw = event.dataTransfer?.getData(mimeType);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function setBuilderDragPayload(event, mimeType, payload) {
  const value = typeof payload === 'string' ? payload : JSON.stringify(payload);
  event.dataTransfer?.setData(mimeType, value);
  // Fallback for browsers that restrict custom MIME types during drop.
  event.dataTransfer?.setData('text/plain', value);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy';
  }
}
