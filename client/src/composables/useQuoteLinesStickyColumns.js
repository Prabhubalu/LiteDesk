import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';

export const QUOTE_LINES_SCROLL_HINT_LEFT = 'quote-lines-table-scroll--reveals-left';
export const QUOTE_LINES_SCROLL_HINT_RIGHT = 'quote-lines-table-scroll--reveals-right';

const OVERFLOW_THRESHOLD_PX = 24;

export function updateQuoteLinesTableScrollHints(el) {
  if (!(el instanceof HTMLElement)) return;
  const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
  el.classList.toggle(QUOTE_LINES_SCROLL_HINT_LEFT, el.scrollLeft > 4);
  el.classList.toggle(
    QUOTE_LINES_SCROLL_HINT_RIGHT,
    maxScroll > 4 && el.scrollLeft < maxScroll - 4
  );
}

/**
 * Activates quote line sticky columns when the table overflows horizontally.
 * Edge shadows appear only after the user scrolls away from an edge.
 */
export function useQuoteLinesStickyColumns(getRoot, deps = []) {
  const stickyColumnsActive = ref(false);
  let observer = null;
  const observed = new Set();

  function getScrollers(root) {
    if (!root) return [];
    return Array.from(root.querySelectorAll('.quote-lines-table-scroll'));
  }

  function resetScrollHints(scrollers) {
    scrollers.forEach((el) => {
      el.classList.remove(QUOTE_LINES_SCROLL_HINT_LEFT, QUOTE_LINES_SCROLL_HINT_RIGHT);
      if (el.scrollLeft) el.scrollLeft = 0;
    });
  }

  function measure() {
    const root = typeof getRoot === 'function' ? getRoot() : getRoot?.value;
    if (!root) {
      stickyColumnsActive.value = false;
      return;
    }

    const scrollers = getScrollers(root);
    const hasOverflow = scrollers.some(
      (el) => el.scrollWidth > el.clientWidth + OVERFLOW_THRESHOLD_PX
    );

    if (!hasOverflow && stickyColumnsActive.value) {
      resetScrollHints(scrollers);
    }

    stickyColumnsActive.value = hasOverflow;
    scrollers.forEach(updateQuoteLinesTableScrollHints);
  }

  function observeScrollers(root) {
    if (!observer || !root) return;
    getScrollers(root).forEach((el) => {
      if (observed.has(el)) return;
      observed.add(el);
      observer.observe(el);
    });
  }

  function remeasureStickyColumns() {
    nextTick(() => {
      const root = typeof getRoot === 'function' ? getRoot() : getRoot?.value;
      if (root && observer) {
        observer.observe(root);
      }
      observeScrollers(root);
      measure();
      // Re-measure after sticky/pricing classes apply to the DOM.
      nextTick(measure);
    });
  }

  onMounted(() => {
    observer = new ResizeObserver(() => measure());
    remeasureStickyColumns();
    if (deps.length) {
      watch(deps, remeasureStickyColumns, { deep: true });
    }
  });

  onUnmounted(() => {
    observer?.disconnect();
    observer = null;
    observed.clear();
  });

  return { stickyColumnsActive, remeasureStickyColumns, updateQuoteLinesTableScrollHints };
}
