import { ref, onUnmounted } from 'vue';

const DEFAULT_PANEL_WIDTH = 320;
const DEFAULT_PANEL_HEIGHT = 52;
const VIEWPORT_MARGIN = 12;
const ANCHOR_GAP = 6;

function resolveElement(refValue) {
  if (!refValue) return null;
  if (refValue instanceof HTMLElement) return refValue;
  if (refValue?.$el instanceof HTMLElement) return refValue.$el;
  return null;
}

/**
 * Fixed-position panel anchored to a trigger element (escapes overflow-hidden parents).
 */
export function useAnchoredPanelPosition(options = {}) {
  const panelWidth = options.panelWidth ?? DEFAULT_PANEL_WIDTH;
  const panelStyle = ref({ top: '0px', left: '0px', width: `${panelWidth}px` });
  const isOpen = ref(false);

  const updatePosition = (triggerRef, panelRef) => {
    const anchor = resolveElement(triggerRef?.value ?? triggerRef);
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const measuredHeight = panelRef?.value?.offsetHeight;
    const height = measuredHeight && measuredHeight > 0 ? measuredHeight : (options.panelHeight ?? DEFAULT_PANEL_HEIGHT);
    const maxWidth = Math.min(panelWidth, window.innerWidth - VIEWPORT_MARGIN * 2);

    let left = rect.left;
    if (left + maxWidth + VIEWPORT_MARGIN > window.innerWidth) {
      left = rect.right - maxWidth;
    }
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - maxWidth - VIEWPORT_MARGIN));

    let top = rect.bottom + ANCHOR_GAP;
    if (top + height + VIEWPORT_MARGIN > window.innerHeight) {
      top = rect.top - height - ANCHOR_GAP;
    }
    top = Math.max(VIEWPORT_MARGIN, top);

    panelStyle.value = {
      top: `${top}px`,
      left: `${left}px`,
      width: `${maxWidth}px`,
    };
  };

  let activeTriggerRef = null;
  let activePanelRef = null;

  const onViewportChange = () => {
    if (!isOpen.value) return;
    updatePosition(activeTriggerRef, activePanelRef);
  };

  const attachListeners = () => {
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
  };

  const detachListeners = () => {
    window.removeEventListener('scroll', onViewportChange, true);
    window.removeEventListener('resize', onViewportChange);
  };

  const openAt = (triggerRef, panelRef) => {
    activeTriggerRef = triggerRef;
    activePanelRef = panelRef;
    isOpen.value = true;
    updatePosition(triggerRef, panelRef);
    attachListeners();
  };

  const close = () => {
    isOpen.value = false;
    activeTriggerRef = null;
    activePanelRef = null;
    detachListeners();
  };

  const refresh = () => {
    if (!isOpen.value) return;
    updatePosition(activeTriggerRef, activePanelRef);
  };

  onUnmounted(detachListeners);

  return {
    panelStyle,
    isOpen,
    openAt,
    close,
    refresh,
    updatePosition,
  };
}
