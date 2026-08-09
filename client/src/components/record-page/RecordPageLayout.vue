<template>
  <div
    ref="layoutRootRef"
    :class="[
      'record-page-layout relative flex flex-col h-full min-h-0 w-full bg-white dark:bg-gray-900 overflow-hidden',
      { 'record-page-layout--left-expanded': leftExpanded, 'record-page-layout--lines-expanded': isLinesExpanded }
    ]"
  >
    <!-- Fixed header - positioned below TabBar -->
    <header
      v-if="$slots.header"
      :class="[
        'record-page-layout__header',
        'flex-shrink-0',
        'bg-white',
        'dark:bg-gray-900',
        useViewportAnchoredLayout
          ? ['fixed', 'z-30', 'record-page-layout__header--positioned']
          : ['relative', 'z-30', 'overflow-visible'],
        { 'transition-all duration-300 ease-in-out': allowTransition },
      ]"
    >
      <slot name="header" />
    </header>
    <!-- Body container - no scroll, only columns scroll -->
    <div :class="['record-page-layout__body', 'relative', 'z-0', 'flex', 'flex-1', 'min-h-0', 'gap-0', bodyPaddingClass, 'pr-0', bodyTopPaddingClass, 'overflow-hidden', 'record-page-layout__body--responsive', useViewportAnchoredLayout && 'record-page-layout__body--with-header', useViewportAnchoredLayout && 'record-page-layout__body--positioned', { 'transition-all duration-300 ease-in-out': allowTransition }]">
      <!-- Left column: Main content (2/3 width) - scrollable; on mobile/tablet hidden unless leftExpanded (e.g. version history) -->
      <div
        v-show="!isMobile || leftExpanded"
        ref="leftEl"
        :class="leftColumnClass"
        @scroll="onLeftScroll"
        @wheel="onLeftWheel"
      >
        <div :class="leftContentClass">
          <slot name="left" :is-mobile="isMobile" />
        </div>
      </div>
      <!-- Right column: Activity sidebar (1/3 width) - hidden when section expanded (e.g. description history) -->
      <aside v-show="!leftExpanded" :class="['record-page-layout__right', 'min-w-0', 'flex', 'flex-col', 'border-l', 'border-gray-200', 'dark:border-gray-700', 'overflow-hidden', isMobile ? 'w-full border-l-0' : 'w-full lg:w-auto lg:flex-shrink-0']">
        <slot name="right" :is-mobile="isMobile">
          <!-- Default slot content -->
        </slot>
      </aside>
    </div>
    
    <!-- Teleport target for Summary tab content - when mobile and not in expanded full-screen view (e.g. version history) -->
    <Teleport v-if="isMobile && summaryTeleportReady && !leftExpanded" to="#record-summary-teleport-target">
      <!-- overflow-visible: overflow-hidden here breaks position:sticky on RecordPageTitleRow -->
      <div class="record-page-layout__summary-content flex min-h-0 w-full flex-1 flex-col overflow-visible px-4 pb-4 pt-0">
        <slot name="left" :is-mobile="isMobile" />
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { onMounted, onUpdated, onUnmounted, nextTick, ref, provide, computed } from 'vue';

/**
 * RecordPageLayout – global record page structure.
 * Top: header slot. Main: two columns (left = record content, right = context panel).
 * All layout CSS variables are set on the layout root so they are scoped and never stale.
 */

const props = defineProps({
  leftExpanded: { type: Boolean, default: false },
  expandedSectionKey: { type: String, default: '' },
  forceMobile: { type: Boolean, default: false },
  /** Tighter chrome for helpdesk case workspace (no left-column vertical padding). */
  dense: { type: Boolean, default: false }
});

const { t } = useI18n();

const MOBILE_BREAKPOINT = 1024;
const TABLET_MIN_WIDTH = 768;
const DEFAULT_HEADER_HEIGHT_PX = 72;

const allowTransition = ref(false);
const leftEl = ref(null);
const layoutRootRef = ref(null);
const leftScrolling = ref(false);
let leftScrollHideTimer = null;
const SCROLL_HIDE_DELAY = 800;

const windowIsMobile = ref(typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT);
const isMobile = computed(() => props.forceMobile || windowIsMobile.value);
/** Desktop work panel: tab bar is in-flow above content — no viewport-fixed record chrome. */
const useViewportAnchoredLayout = computed(() => !props.forceMobile && windowIsMobile.value);
const summaryTeleportReady = ref(false);

const isLinesExpanded = computed(() => props.leftExpanded && props.expandedSectionKey === 'lines');
const WIDE_EXPANDED_SECTION_KEYS = new Set(['content-editor', 'description-history', 'rich-content-history']);
const isWideExpandedContent = computed(
  () => props.leftExpanded && WIDE_EXPANDED_SECTION_KEYS.has(props.expandedSectionKey)
);

const bodyPaddingClass = computed(() => {
  if (isMobile.value) return 'px-0';
  if (isLinesExpanded.value) return 'px-2 lg:px-4';
  if (isWideExpandedContent.value) return 'px-6 lg:px-8';
  if (props.leftExpanded) return 'px-4';
  return 'px-6';
});

const bodyTopPaddingClass = computed(() => 'pt-0');

const leftColumnClass = computed(() => [
  'record-page-layout__left',
  'flex',
  'flex-col',
  'min-w-0',
  'flex-1',
  'lg:flex-[2]',
  'overflow-x-hidden',
  { 'is-scrolling': leftScrolling.value },
  isLinesExpanded.value
    ? ['flex-[1_1_100%]', 'max-w-full', 'pr-0', 'min-h-0', 'overflow-hidden', 'py-0']
    : props.leftExpanded
      ? ['flex-[1_1_100%]', 'max-w-full', 'pr-0', 'min-h-0', 'overflow-y-auto', props.dense ? 'py-0' : 'py-6']
      : [props.dense ? 'py-0' : 'py-6', props.dense ? 'pr-0' : 'pr-10', 'overflow-y-auto']
]);

const wideLeftContentClass = 'record-page-layout__left-content w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col flex-1 min-h-0';

const leftContentClass = computed(() => {
  if (isLinesExpanded.value) {
    return 'record-page-layout__left-content w-[90%] max-w-[90%] mx-auto px-3 sm:px-4 lg:px-6 flex flex-col flex-1 min-h-0 h-full overflow-hidden';
  }
  if (isWideExpandedContent.value) {
    return wideLeftContentClass;
  }
  if (props.leftExpanded) {
    return 'record-page-layout__left-content max-w-6xl mx-auto w-full px-6 flex flex-col flex-1 min-h-0';
  }
  if (props.dense) {
    return 'record-page-layout__left-content w-full min-h-0 flex-1 flex flex-col px-0';
  }
  return 'record-page-layout__left-content max-w-6xl mx-auto w-full px-6';
});

provide('recordLayoutIsMobile', computed(() => isMobile.value));
provide('recordLayoutSummaryTeleportReady', summaryTeleportReady);

function showLeftScrollbar() {
  leftScrolling.value = true;
  if (leftScrollHideTimer) clearTimeout(leftScrollHideTimer);
  leftScrollHideTimer = setTimeout(() => {
    leftScrolling.value = false;
    leftScrollHideTimer = null;
  }, SCROLL_HIDE_DELAY);
}

function onLeftScroll() { showLeftScrollbar(); }
function onLeftWheel() { showLeftScrollbar(); }

// --- Layout: single source of truth, variables scoped to layout root ---
let resizeHandler = null;
let sidebarToggleHandler = null;
let headerResizeObserver = null;
let layoutMutationObserver = null;
let visibilityHandler = null;
let rafId = null;

function applyLayout() {
  const root = layoutRootRef.value;
  if (!root || props.forceMobile) return;

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const isMobileView = viewportWidth < MOBILE_BREAKPOINT;
  const headerEl = root.querySelector('.record-page-layout__header');
  const headerHeightPx = headerEl ? headerEl.offsetHeight : DEFAULT_HEADER_HEIGHT_PX;

  root.style.setProperty('--header-height', `${headerHeightPx}px`);

  if (!isMobileView) {
    root.style.setProperty('--tabbar-height', '0px');
    root.style.setProperty('--sidebar-width', '0px');
    root.style.setProperty('--header-top', '0px');
    root.style.setProperty('--header-left', '0px');
    root.style.setProperty('--body-left', '0px');
    return;
  }

  const mobileTopNavHeight = 64;
  const tabBarHeight = 48;
  const isTabletView = viewportWidth >= TABLET_MIN_WIDTH;
  const tabBarTopOffset = isTabletView ? mobileTopNavHeight + tabBarHeight : mobileTopNavHeight;

  root.style.setProperty('--tabbar-height', `${tabBarTopOffset}px`);
  root.style.setProperty('--sidebar-width', '0px');
  root.style.setProperty('--header-top', `${tabBarTopOffset}px`);
  root.style.setProperty('--header-left', '0px');
  root.style.setProperty('--body-left', '0px');
}

function scheduleLayout() {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    rafId = null;
    applyLayout();
  });
}

function observeHeaderWhenPresent() {
  const root = layoutRootRef.value;
  if (!root || !headerResizeObserver) return;
  const header = root.querySelector('.record-page-layout__header');
  if (header) {
    try {
      headerResizeObserver.observe(header);
    } catch (_) { /* already observed */ }
  }
}

onMounted(async () => {
  await nextTick();
  const el = leftEl.value;
  if (el) el.addEventListener('touchstart', showLeftScrollbar, { passive: true });

  if (props.forceMobile) return;

  const root = layoutRootRef.value;
  if (root) {
    let parent = root.parentElement;
    while (parent && parent !== document.body) {
      const oy = getComputedStyle(parent).overflowY;
      if (oy === 'auto' || oy === 'scroll' || parent.classList.contains('overflow-y-auto')) {
        parent.classList.add('record-page-parent-no-scroll');
        parent.style.overflowY = 'hidden';
        break;
      }
      parent = parent.parentElement;
    }
  }

  applyLayout();
  observeHeaderWhenPresent();

  if (root && typeof ResizeObserver !== 'undefined') {
    headerResizeObserver = new ResizeObserver(() => scheduleLayout());
    nextTick(observeHeaderWhenPresent);
  }

  if (root && typeof MutationObserver !== 'undefined') {
    layoutMutationObserver = new MutationObserver(() => scheduleLayout());
    layoutMutationObserver.observe(root, { childList: true, subtree: true });
  }

  visibilityHandler = () => {
    if (document.visibilityState === 'visible') scheduleLayout();
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  setTimeout(() => { allowTransition.value = true; }, 50);

  resizeHandler = () => {
    windowIsMobile.value = typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT;
    applyLayout();
  };
  window.addEventListener('resize', resizeHandler);

  sidebarToggleHandler = () => {
    requestAnimationFrame(applyLayout);
  };
  window.addEventListener('sidebar-toggle', sidebarToggleHandler);

  // Catch header appearing after async record load / prev-next
  setTimeout(scheduleLayout, 0);
  setTimeout(scheduleLayout, 150);
  setTimeout(scheduleLayout, 400);
});

onUpdated(() => {
  if (props.forceMobile) return;
  scheduleLayout();
  nextTick(observeHeaderWhenPresent);
});

onUnmounted(() => {
  if (leftScrollHideTimer) clearTimeout(leftScrollHideTimer);
  const el = leftEl.value;
  if (el) el.removeEventListener('touchstart', showLeftScrollbar);

  if (rafId !== null) cancelAnimationFrame(rafId);
  headerResizeObserver?.disconnect();
  layoutMutationObserver?.disconnect();
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);

  const parentWithNoScroll = document.querySelector('.record-page-parent-no-scroll');
  if (parentWithNoScroll) {
    parentWithNoScroll.classList.remove('record-page-parent-no-scroll');
    parentWithNoScroll.style.overflowY = '';
  }

  if (resizeHandler) window.removeEventListener('resize', resizeHandler);
  if (sidebarToggleHandler) window.removeEventListener('sidebar-toggle', sidebarToggleHandler);
});
</script>

<style scoped>
.record-page-layout__body--responsive {
  flex-direction: column;
}
@media (min-width: 1024px) {
  .record-page-layout__body--responsive {
    flex-direction: row;
  }
}

/* Position header below TabBar and account for sidebar */
.record-page-layout__header--positioned {
  top: var(--tabbar-height, 48px);
  left: var(--header-left, 0px);
  right: var(--header-right, 0px);
}

/* Body padding = record header only; PlatformShell already offsets nav/TabBar (pt-16 / md:pt-[7.5rem]) */
.record-page-layout__body--with-header {
  padding-top: var(--header-height, 120px);
  margin-top: 0;
}

/* Position body to respect sidebar width */
.record-page-layout__body--positioned {
  margin-left: var(--body-left, 0px);
  width: calc(100% - var(--body-left, 0px));
}

/* Ensure header has proper shadow when scrolling */
/* .record-page-layout__header {
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
}

:global(.dark) .record-page-layout__header {
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.3), 0 1px 2px -1px rgb(0 0 0 / 0.2);
} */

/* Section spacing in left column (scoped CSS so it always applies) */
.record-page-layout__left-content > * + * {
  margin-top: 0.75rem; /* 12px */
}

.record-page-layout--lines-expanded .record-page-layout__left-content > * + * {
  margin-top: 0;
}

.record-page-layout--lines-expanded .record-page-layout__left-content {
  height: 100%;
}

/* Smooth scrolling for left column; scrollbar hidden by default, shown when scrolling */
.record-page-layout__left {
  scroll-behavior: smooth;
  scrollbar-color: transparent transparent;
  scrollbar-width: thin;
}

.record-page-layout__left.is-scrolling {
  scrollbar-color: rgba(0, 0, 0, 0.25) transparent;
}

.record-page-layout__left::-webkit-scrollbar {
  width: 8px;
}

.record-page-layout__left::-webkit-scrollbar-track {
  background: transparent;
}

.record-page-layout__left::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 4px;
}

.record-page-layout__left.is-scrolling::-webkit-scrollbar-thumb {
  background: rgb(203 213 225);
}

:global(.dark) .record-page-layout__left.is-scrolling {
  scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
}

:global(.dark) .record-page-layout__left.is-scrolling::-webkit-scrollbar-thumb {
  background: rgb(75 85 99);
}

/* Right column scrolling is handled by RecordRightPane */

/* Show pointer cursor on clickable elements */
.record-page-layout :deep(button:not(:disabled)),
.record-page-layout :deep(a[href]),
.record-page-layout :deep([role="button"]),
.record-page-layout :deep([role="tab"]) {
  cursor: pointer;
}

/* Summary content teleported to right pane on mobile */
.record-page-layout__summary-content > * + * {
  margin-top: 0.75rem; /* 12px - match left column spacing */
}
</style>
