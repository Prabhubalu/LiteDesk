import { onMounted, ref } from 'vue';

/**
 * Vertical pane resize (drag top edge up/down). Height is clamped and optionally persisted.
 */
export function useVerticalPaneResize({
  storageKey,
  defaultHeight = 180,
  minHeight = 120,
  maxHeightRatio = 0.65,
  absoluteMaxHeight = 520
} = {}) {
  const height = ref(defaultHeight);
  const isResizing = ref(false);
  const paneRef = ref(null);

  function readStoredHeight() {
    if (!storageKey || typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(storageKey);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function persistHeight(value) {
    if (!storageKey || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(storageKey, String(Math.round(value)));
    } catch {
      /* ignore quota */
    }
  }

  function getMaxHeight() {
    const parent = paneRef.value?.parentElement;
    const parentH = parent?.clientHeight ?? window.innerHeight;
    return Math.min(absoluteMaxHeight, Math.floor(parentH * maxHeightRatio));
  }

  function clampHeight(value) {
    const max = Math.max(minHeight, getMaxHeight());
    return Math.min(max, Math.max(minHeight, value));
  }

  onMounted(() => {
    const stored = readStoredHeight();
    if (stored != null) height.value = clampHeight(stored);
    else height.value = clampHeight(defaultHeight);
  });

  function startResize(event) {
    if (event.button !== 0) return;
    event.preventDefault();

    const startY = event.clientY;
    const startHeight = height.value;
    isResizing.value = true;

    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    function onPointerMove(ev) {
      const delta = startY - ev.clientY;
      height.value = clampHeight(startHeight + delta);
    }

    function endResize() {
      isResizing.value = false;
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
      persistHeight(height.value);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endResize);
      window.removeEventListener('pointercancel', endResize);
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endResize);
    window.addEventListener('pointercancel', endResize);
  }

  return {
    height,
    isResizing,
    paneRef,
    startResize,
    clampHeight
  };
}
