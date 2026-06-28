import { ref, nextTick } from 'vue';

const STICKY_TITLE_ENABLE_OFFSET = 10;
const STICKY_TITLE_DISABLE_OFFSET = 2;
const LEFT_PANE_SELECTOR = '.record-page-layout__left';
const EMBED_SUMMARY_CONTENT_SELECTOR = '.record-page-layout__summary-content';

function isVisibleScrollPane(el) {
  if (!(el instanceof HTMLElement)) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && el.clientHeight > 0;
}

function findEmbedSummaryScrollContainer(rootEl) {
  const summaryContent =
    (rootEl instanceof HTMLElement ? rootEl.querySelector(EMBED_SUMMARY_CONTENT_SELECTOR) : null)
    || document.querySelector(`.record-right-pane-drawer ${EMBED_SUMMARY_CONTENT_SELECTOR}`);
  if (summaryContent instanceof HTMLElement) {
    let el = summaryContent.parentElement;
    while (el) {
      const { overflowY } = getComputedStyle(el);
      if ((overflowY === 'auto' || overflowY === 'scroll') && isVisibleScrollPane(el)) {
        return el;
      }
      if (el.classList?.contains('record-right-pane')) break;
      el = el.parentElement;
    }
  }

  const paneScoped =
    (rootEl instanceof HTMLElement ? rootEl.querySelector('.record-right-pane .overflow-y-auto') : null)
    || document.querySelector('.record-right-pane-drawer .record-right-pane .overflow-y-auto');
  return isVisibleScrollPane(paneScoped) ? paneScoped : null;
}

export function findTitleScrollContainer(rootEl) {
  if (!(rootEl instanceof HTMLElement)) return null;

  const leftPaneEl = rootEl.querySelector(LEFT_PANE_SELECTOR);
  if (leftPaneEl && isVisibleScrollPane(leftPaneEl)) {
    return leftPaneEl;
  }

  return findEmbedSummaryScrollContainer(rootEl);
}

/**
 * Composable for record page sticky title row: tracks scroll on the left pane
 * and exposes isLeftTitleSticky so the title bar can show border/background when sticky.
 *
 * @param {import('vue').Ref<HTMLElement | null>} pageRootRef - Ref to the record page root element that contains .record-page-layout__left
 * @returns {{ isLeftTitleSticky: import('vue').Ref<boolean>, attach: () => boolean, detach: () => void, reset: () => void }}
 */
export function useStickyTitleRow(pageRootRef) {
  const isLeftTitleSticky = ref(false);
  const leftPaneScrollElement = ref(null);

  const updateStickyTitleState = (scrollTop) => {
    if (isLeftTitleSticky.value) {
      if (scrollTop <= STICKY_TITLE_DISABLE_OFFSET) {
        isLeftTitleSticky.value = false;
      }
      return;
    }
    if (scrollTop >= STICKY_TITLE_ENABLE_OFFSET) {
      isLeftTitleSticky.value = true;
    }
  };

  const handleLeftPaneScroll = (event) => {
    const nextScrollTop = event?.target?.scrollTop ?? 0;
    updateStickyTitleState(nextScrollTop);
  };

  const detach = () => {
    if (!leftPaneScrollElement.value) return;
    leftPaneScrollElement.value.removeEventListener('scroll', handleLeftPaneScroll);
    leftPaneScrollElement.value = null;
  };

  const reset = () => {
    isLeftTitleSticky.value = false;
  };

  const attach = () => {
    const rootEl = pageRootRef?.value ?? pageRootRef;
    const scrollEl = findTitleScrollContainer(rootEl);
    if (!scrollEl) return false;
    if (leftPaneScrollElement.value === scrollEl) {
      updateStickyTitleState(scrollEl.scrollTop ?? 0);
      return true;
    }
    detach();
    leftPaneScrollElement.value = scrollEl;
    updateStickyTitleState(scrollEl.scrollTop ?? 0);
    scrollEl.addEventListener('scroll', handleLeftPaneScroll, { passive: true });
    return true;
  };

  /** Call after content is ready (e.g. when loading becomes false or record is set). Uses nextTick + rAF fallback. */
  const attachWhenReady = () => {
    nextTick(() => {
      if (attach()) return;
      requestAnimationFrame(() => {
        if (attach()) return;
        setTimeout(attach, 150);
        setTimeout(attach, 400);
      });
    });
  };

  return {
    isLeftTitleSticky,
    attach,
    detach,
    reset,
    attachWhenReady
  };
}
