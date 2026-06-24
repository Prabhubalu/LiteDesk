<template>
  <div
    ref="paneRootRef"
    :class="[
      'record-right-pane relative flex min-w-0 flex-col h-full bg-white dark:bg-gray-900 overflow-hidden',
      isResizing ? 'record-right-pane--no-transition' : 'transition-[width] duration-300 ease-out',
      { 'is-scrolling': isScrolling },
      fullWidth || layoutIsMobile
        ? 'w-full flex-1'
        : activeTab
          ? 'w-full lg:flex-shrink-0'
          : 'w-20'
    ]"
    :style="paneRootStyle"
    @scroll.capture="showScrollbar"
    @wheel.capture="showScrollbar"
    @touchstart.capture="showScrollbar"
  >
    <div
      v-if="isResizableDesktop"
      role="separator"
      aria-orientation="vertical"
      :aria-valuemin="MIN_PANE_WIDTH_PX"
      :aria-valuemax="maxPaneWidthPx"
      :aria-valuenow="effectivePaneWidthPx"
      :aria-label="t('records.rightPaneResizeHandle')"
      :title="t('records.rightPaneResizeHint')"
      class="record-right-pane-resize-handle group absolute left-0 top-0 z-30 flex h-full w-5 -translate-x-1/2 touch-none select-none items-center justify-center"
      :class="{ 'record-right-pane-resize-handle--active': isResizing }"
      @pointerdown.prevent="startPaneResize"
      @dblclick.prevent="resetPaneWidth"
    >
      <span class="record-right-pane-resize-line" aria-hidden="true" />
      <span class="record-right-pane-resize-grip" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </div>
    <!-- Header: in embed/quick-preview mode (showHeader + showCloseButton) only show prefix and close to avoid duplicating the main page header -->
    <div v-if="showHeader" class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-900 z-20 relative">
      <div class="flex items-center gap-2 min-w-0">
        <slot name="header-prefix" />
        <template v-if="!showCloseButton">
          <span v-if="title" class="text-sm font-medium text-gray-900 dark:text-white">{{ title }}</span>
          <span v-if="title && recordId" class="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 shrink-0" aria-hidden="true" />
          <span v-if="recordId" class="text-xs text-gray-500 dark:text-gray-400 font-mono shrink-0">
            {{ recordId.slice(-8) }}
          </span>
        </template>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <slot name="header-actions" />
        <button
          v-if="showCloseButton"
          @click="$emit('close')"
          class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
        >
          <XMarkIcon class="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>
    </div>

    <!-- Content - Split Layout -->
    <div class="flex-1 overflow-hidden flex">
      <!-- Main Content Area - Always render for smooth transitions -->
      <div 
        ref="scrollContainer"
        class="flex-1 overflow-x-hidden transition-all duration-300 min-h-0 flex flex-col"
        :class="[
          { 'opacity-0': !activeTab, 'opacity-100': activeTab },
          activeTab === 'summary' && props.summaryLayout === 'fill'
            ? 'overflow-hidden'
            : 'overflow-y-auto',
          layoutIsMobile && activeTab === 'summary'
            ? 'bg-white dark:bg-gray-900'
            : 'bg-gray-50 dark:bg-gray-900'
        ]"
      >
        <!-- Dynamic Tab Content - single wrapper for active tab only so it gets full height -->
        <div class="w-full h-full flex-1 flex flex-col min-h-0">
          <template v-for="tab in effectiveTabs" :key="tab.id">
            <div v-if="activeTab === tab.id" class="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
              <!-- Summary tab: use teleport target for layout's left content on mobile -->
              <template v-if="tab.id === 'summary' && layoutIsMobile">
                <div
                  :class="[
                    'flex-1 min-h-0 h-full',
                    props.summaryLayout === 'fill'
                      ? 'flex flex-col overflow-hidden'
                      : 'overflow-y-auto overflow-x-hidden'
                  ]"
                >
                  <div
                    id="record-summary-teleport-target"
                    :class="[
                      'record-right-pane__summary-content w-full',
                      props.summaryLayout === 'fill'
                        ? 'flex h-full min-h-0 flex-1 flex-col overflow-hidden max-w-none mx-0 px-0 pt-0 pb-0'
                        : 'max-w-4xl mx-auto px-6 pt-0 pb-6'
                    ]"
                  >
                    <!-- Content will be teleported here from RecordPageLayout -->
                    <slot :name="`tab-${tab.id}`">
                      <!-- Fallback if no slot provided and teleport hasn't happened yet -->
                    </slot>
                  </div>
                </div>
              </template>
              <template v-else-if="tab.id === 'summary' && props.summaryLayout === 'fill'">
                <div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                  <slot :name="`tab-${tab.id}`" />
                </div>
              </template>
              <!-- Regular tabs -->
              <template v-else>
                <slot :name="`tab-${tab.id}`">
                  <div class="text-center py-12 text-gray-500 dark:text-gray-400">
                    <p>{{ t('records.tabContentFallback', { name: tab.name }) }}</p>
                  </div>
                </slot>
              </template>
            </div>
          </template>
        </div>
      </div>

      <!-- Right Sidebar - Tabs (ml-auto keeps tabs on the right when content is collapsed) -->
      <div class="w-20 ml-auto border-l border-gray-200 dark:border-gray-700 flex flex-col items-center py-4 gap-2 flex-shrink-0">
        <button
          v-for="tab in effectiveTabs"
          :key="tab.id"
          @click="handleTabClick(tab.id)"
          class="w-full p-2.5 transition-colors cursor-pointer flex flex-col items-center gap-1"
          :title="tab.name"
        >
          <div
            :class="[
              'p-2 rounded-lg flex items-center justify-center',
              activeTab === tab.id
                ? 'bg-gray-100 dark:bg-gray-700'
                : ''
            ]"
          >
            <component
              :is="getTabIcon(tab.id)"
              :class="[
                'w-5 h-5 flex-shrink-0',
                activeTab === tab.id
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-600 dark:text-gray-400'
              ]"
            />
          </div>
          <span 
            :class="[
              'text-[10.5px] font-medium leading-tight text-center',
              activeTab === tab.id
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-gray-600 dark:text-gray-400'
            ]"
          >
            {{ tab.name }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUpdated, onBeforeUnmount, computed, inject, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { 
  XMarkIcon, 
  RectangleStackIcon, 
  DocumentTextIcon,
  ClockIcon,
  ChatBubbleLeftRightIcon,
  LinkIcon,
  PuzzlePieceIcon,
  Squares2X2Icon,
  BookOpenIcon,
  EnvelopeIcon,
  UserGroupIcon,
  EyeIcon,
  ClipboardDocumentListIcon,
  DocumentDuplicateIcon,
  Bars3BottomLeftIcon
} from '@heroicons/vue/24/outline';

const { t } = useI18n();

const PANE_WIDTH_STORAGE_KEY = 'arivu:record-right-pane-width-px';
const PANE_WIDTH_RESIZED_KEY = 'arivu:record-right-pane-user-resized';
const DEFAULT_PANE_WIDTH_PX = 500;
const MIN_PANE_WIDTH_PX = 480;
const MAX_PANE_WIDTH_PX = 720;
const LEFT_CONTENT_MIN_PX = 380;
const RESIZE_DRAG_THRESHOLD_PX = 4;

function loadPaneUserResized() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(PANE_WIDTH_RESIZED_KEY) === 'true';
}

function loadPaneWidthPx() {
  if (typeof window === 'undefined') return DEFAULT_PANE_WIDTH_PX;
  if (!loadPaneUserResized()) return DEFAULT_PANE_WIDTH_PX;
  const stored = Number(window.localStorage.getItem(PANE_WIDTH_STORAGE_KEY));
  if (Number.isFinite(stored)) return stored;
  return DEFAULT_PANE_WIDTH_PX;
}

// Inject mobile state from RecordPageLayout
const layoutIsMobile = inject('recordLayoutIsMobile', ref(false));
const layoutSummaryTeleportReady = inject('recordLayoutSummaryTeleportReady', ref(false));

const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  recordId: {
    type: String,
    default: ''
  },
  showHeader: {
    type: Boolean,
    default: true
  },
  showCloseButton: {
    type: Boolean,
    default: false
  },
  defaultTab: {
    type: String,
    default: null
  },
  tabs: {
    type: Array,
    default: undefined
  },
  persistenceKey: {
    type: String,
    default: null
  },
  /** Quick preview / embed: span the drawer width instead of capping at 500px on large screens */
  fullWidth: {
    type: Boolean,
    default: false
  },
  /** Summary tab (mobile/embed): scroll entire pane vs fill height and let child manage scroll */
  summaryLayout: {
    type: String,
    default: 'scroll',
    validator: (v) => v === 'scroll' || v === 'fill'
  }
});

const resolvedTabs = computed(() => {
  if (props.tabs?.length) return props.tabs;
  return [
    { id: 'summary', name: t('records.tabSummary') },
    { id: 'details', name: t('records.tabDetails') },
    { id: 'updates', name: t('records.tabUpdates') }
  ];
});

// Computed tabs that includes Summary tab on mobile
const effectiveTabs = computed(() => {
  const base = resolvedTabs.value;
  if (layoutIsMobile.value) {
    // Check if Summary tab already exists
    const hasSummaryTab = base.some(tab => tab.id === 'summary');
    if (!hasSummaryTab) {
      return [
        { id: 'summary', name: t('records.tabSummary'), icon: Squares2X2Icon },
        ...base
      ];
    }
  }
  return base;
});

const emit = defineEmits(['close', 'tab-change', 'active-tab-change']);

// Get storage key for this instance
const getStorageKey = () => {
  if (props.persistenceKey) {
    return `record-right-pane-tab-${props.persistenceKey}`;
  }
  if (props.recordId) {
    return `record-right-pane-tab-${props.recordId}`;
  }
  return null;
};

// Load persisted tab from localStorage
const loadPersistedTab = () => {
  const storageKey = getStorageKey();
  if (!storageKey) return null;
  
  try {
    const persisted = localStorage.getItem(storageKey);
    if (persisted) {
      // Verify the tab still exists in tabs array
      const tabExists = resolvedTabs.value.some(tab => tab.id === persisted);
      if (tabExists) {
        return persisted;
      }
    }
  } catch (e) {
    console.warn('Failed to load persisted tab:', e);
  }
  return null;
};

// Save tab to localStorage
const savePersistedTab = (tabId) => {
  const storageKey = getStorageKey();
  if (!storageKey) return;
  
  try {
    if (tabId) {
      localStorage.setItem(storageKey, tabId);
    } else {
      localStorage.removeItem(storageKey);
    }
  } catch (e) {
    console.warn('Failed to save persisted tab:', e);
  }
};

const resolveActiveTab = () => loadPersistedTab() || props.defaultTab || null;

// Initialize activeTab with priority: persisted > defaultTab prop > null
const activeTab = ref(resolveActiveTab());
const paneRootRef = ref(null);
const paneUserResized = ref(loadPaneUserResized());
const paneWidthPx = ref(loadPaneWidthPx());
const isResizing = ref(false);
const scrollContainer = ref(null);
const isScrolling = ref(false);
let scrollHideTimer = null;
const SCROLL_HIDE_DELAY = 800;
let resizeHandleEl = null;
let resizePointerId = null;
let resizeStartX = 0;
let resizeStartWidthPx = 0;
let resizeDidDrag = false;
let windowResizeHandler = null;

const isResizableDesktop = computed(
  () => !props.fullWidth && !layoutIsMobile.value && !!activeTab.value
);

function getResizeContainerWidth() {
  const el = paneRootRef.value;
  if (!el) {
    return typeof window !== 'undefined' ? window.innerWidth : 1280;
  }
  const body = el.closest('.record-page-layout__body');
  if (body) return body.getBoundingClientRect().width;
  return el.parentElement?.getBoundingClientRect().width ?? window.innerWidth;
}

function clampPaneWidth(width) {
  const containerWidth = getResizeContainerWidth();
  const maxByViewport = Math.max(MIN_PANE_WIDTH_PX, containerWidth - LEFT_CONTENT_MIN_PX);
  const max = Math.min(MAX_PANE_WIDTH_PX, maxByViewport);
  return Math.min(max, Math.max(MIN_PANE_WIDTH_PX, width));
}

const maxPaneWidthPx = computed(() => clampPaneWidth(MAX_PANE_WIDTH_PX));

const effectivePaneWidthPx = computed(() => {
  const baseWidth = paneUserResized.value ? paneWidthPx.value : DEFAULT_PANE_WIDTH_PX;
  return clampPaneWidth(baseWidth);
});

const paneRootStyle = computed(() => {
  if (!isResizableDesktop.value) return undefined;
  return {
    width: `${effectivePaneWidthPx.value}px`,
    minWidth: `${MIN_PANE_WIDTH_PX}px`,
    maxWidth: '100%'
  };
});

function persistPaneWidth() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PANE_WIDTH_STORAGE_KEY, String(Math.round(paneWidthPx.value)));
  window.localStorage.setItem(PANE_WIDTH_RESIZED_KEY, 'true');
}

function endPaneResize({ persist = false } = {}) {
  if (!isResizing.value) return;
  isResizing.value = false;

  if (resizeHandleEl && resizePointerId != null) {
    try {
      resizeHandleEl.releasePointerCapture(resizePointerId);
    } catch {
      /* ignore */
    }
  }

  resizeHandleEl = null;
  resizePointerId = null;
  resizeDidDrag = false;
  document.body.classList.remove('record-right-pane-resizing');
  document.removeEventListener('pointermove', onPaneResize);
  document.removeEventListener('pointerup', stopPaneResize);
  document.removeEventListener('pointercancel', stopPaneResize);
  window.removeEventListener('blur', onPaneResizeAbort);

  if (persist) {
    persistPaneWidth();
  }
}

function onPaneResizeAbort() {
  endPaneResize({ persist: false });
}

function startPaneResize(event) {
  if (!(event instanceof PointerEvent) || event.button !== 0) return;

  endPaneResize({ persist: false });

  resizeHandleEl = event.currentTarget;
  resizePointerId = event.pointerId;
  resizeStartX = event.clientX;
  resizeStartWidthPx = effectivePaneWidthPx.value;
  resizeDidDrag = false;
  isResizing.value = true;

  try {
    resizeHandleEl.setPointerCapture(event.pointerId);
  } catch {
    /* ignore */
  }

  document.addEventListener('pointermove', onPaneResize);
  document.addEventListener('pointerup', stopPaneResize);
  document.addEventListener('pointercancel', stopPaneResize);
  window.addEventListener('blur', onPaneResizeAbort);
}

function onPaneResize(event) {
  if (!isResizing.value || !(event instanceof PointerEvent)) return;

  const deltaX = resizeStartX - event.clientX;
  if (!resizeDidDrag && Math.abs(deltaX) < RESIZE_DRAG_THRESHOLD_PX) return;

  if (!resizeDidDrag) {
    resizeDidDrag = true;
    document.body.classList.add('record-right-pane-resizing');
  }

  paneUserResized.value = true;
  paneWidthPx.value = clampPaneWidth(resizeStartWidthPx + deltaX);
}

function stopPaneResize() {
  endPaneResize({ persist: resizeDidDrag });
}

function resetPaneWidth() {
  paneUserResized.value = false;
  paneWidthPx.value = DEFAULT_PANE_WIDTH_PX;
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(PANE_WIDTH_STORAGE_KEY);
    window.localStorage.removeItem(PANE_WIDTH_RESIZED_KEY);
  }
}

function showScrollbar() {
  isScrolling.value = true;
  if (scrollHideTimer) clearTimeout(scrollHideTimer);
  scrollHideTimer = setTimeout(() => {
    isScrolling.value = false;
    scrollHideTimer = null;
  }, SCROLL_HIDE_DELAY);
}

onMounted(() => {
  if (!activeTab.value) {
    activeTab.value = resolveActiveTab();
  }

  windowResizeHandler = () => {
    if (paneUserResized.value) {
      paneWidthPx.value = clampPaneWidth(paneWidthPx.value);
    }
  };
  window.addEventListener('resize', windowResizeHandler);
});

const syncSummaryTeleportReady = () => {
  const shouldEnable = layoutIsMobile.value && activeTab.value === 'summary';
  if (!shouldEnable) {
    layoutSummaryTeleportReady.value = false;
    return;
  }

  nextTick(() => {
    const targetExists = !!document.getElementById('record-summary-teleport-target');
    layoutSummaryTeleportReady.value = targetExists;
  });
};

// Signal when the Summary tab teleport target is ready
// This ensures the teleport target exists before RecordPageLayout teleports content
watch([activeTab, layoutIsMobile], syncSummaryTeleportReady, {
  immediate: true,
  flush: 'post'
});

onUpdated(syncSummaryTeleportReady);

onBeforeUnmount(() => {
  if (scrollHideTimer) clearTimeout(scrollHideTimer);
  layoutSummaryTeleportReady.value = false;
  endPaneResize({ persist: false });
  if (windowResizeHandler) {
    window.removeEventListener('resize', windowResizeHandler);
    windowResizeHandler = null;
  }
});

watch(() => props.defaultTab, () => {
  activeTab.value = resolveActiveTab();
});

watch(
  () => props.persistenceKey || props.recordId,
  () => {
    activeTab.value = resolveActiveTab();
  }
);

// When switching to mobile, auto-select Summary tab if no tab is selected
watch(layoutIsMobile, (isMobile) => {
  if (isMobile && !activeTab.value) {
    // Auto-select Summary tab on mobile if nothing is selected
    activeTab.value = 'summary';
  }
}, { immediate: true });

// Watch for activeTab changes and emit to parent + persist
watch(activeTab, (newTab) => {
  emit('active-tab-change', newTab);
  savePersistedTab(newTab);
});

// Handle tab click
const handleTabClick = (tabId) => {
  if (activeTab.value === tabId) {
    // On mobile, don't allow deselecting tabs (content must be visible)
    if (layoutIsMobile.value) {
      return;
    }
    // If clicking the same tab, deselect it
    activeTab.value = null;
    emit('tab-change', null);
  } else {
    activeTab.value = tabId;
    emit('tab-change', tabId);
  }
};

// Expose activeTab for parent access
defineExpose({
  activeTab,
  hasActiveTab: () => !!activeTab.value,
  isMobile: layoutIsMobile
});

// Get icon for tab
const getTabIcon = (tabId) => {
  // First check if tab has an icon property in effectiveTabs (includes injected Summary)
  const tab = effectiveTabs.value.find(t => t.id === tabId);
  if (tab && tab.icon) {
    return tab.icon;
  }
  
  // Then check props.tabs
  const propTab = resolvedTabs.value.find(t => t.id === tabId);
  if (propTab && propTab.icon) {
    return propTab.icon;
  }
  
  // Fallback to default icon map
  const iconMap = {
    summary: Squares2X2Icon,
    activity: ClockIcon,
    details: Bars3BottomLeftIcon,
    updates: ClockIcon,
    preview: EyeIcon,
    responses: ClipboardDocumentListIcon,
    documents: DocumentDuplicateIcon,
    comments: ChatBubbleLeftRightIcon,
    timeline: ClockIcon,
    related: LinkIcon,
    integrations: PuzzlePieceIcon,
    knowledge: BookOpenIcon,
    email: EnvelopeIcon,
    participants: UserGroupIcon
  };
  return iconMap[tabId] || RectangleStackIcon;
};
</script>

<style scoped>
/* Match RecordPageLayout left column: hidden until scrolling */
.record-right-pane :deep(.overflow-y-auto) {
  scrollbar-color: transparent transparent;
  scrollbar-width: thin;
}

.record-right-pane.is-scrolling :deep(.overflow-y-auto) {
  scrollbar-color: rgba(0, 0, 0, 0.25) transparent;
}

.record-right-pane :deep(.overflow-y-auto)::-webkit-scrollbar {
  width: 8px;
}

.record-right-pane :deep(.overflow-y-auto)::-webkit-scrollbar-track {
  background: transparent;
}

.record-right-pane :deep(.overflow-y-auto)::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 4px;
}

.record-right-pane.is-scrolling :deep(.overflow-y-auto)::-webkit-scrollbar-thumb {
  background: rgb(203 213 225);
}

:global(.dark) .record-right-pane.is-scrolling :deep(.overflow-y-auto) {
  scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
}

:global(.dark) .record-right-pane.is-scrolling :deep(.overflow-y-auto)::-webkit-scrollbar-thumb {
  background: rgb(75 85 99);
}

/* Summary content spacing (teleported from RecordPageLayout) */
.record-right-pane__summary-content > * + * {
  margin-top: 0.75rem;
}

.record-right-pane--no-transition {
  transition: none;
}

.record-right-pane-resize-handle {
  cursor: col-resize;
}

.record-right-pane-resize-line {
  position: absolute;
  inset: 0 auto 0 50%;
  width: 1px;
  transform: translateX(-50%);
  background: transparent;
  transition: background-color 0.15s ease, width 0.15s ease;
}

.record-right-pane-resize-grip {
  position: relative;
  z-index: 1;
  display: flex;
  height: 2.75rem;
  width: 0.55rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  border-radius: 9999px;
  border: 1px solid transparent;
  background: transparent;
  opacity: 0;
  transition: opacity 0.15s ease, border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
}

.record-right-pane-resize-grip span {
  display: block;
  height: 1rem;
  width: 2px;
  border-radius: 9999px;
  background: rgb(156 163 175);
}

.record-right-pane-resize-handle:hover .record-right-pane-resize-line,
.record-right-pane-resize-handle--active .record-right-pane-resize-line {
  width: 2px;
  background: rgb(99 102 241 / 0.45);
}

.record-right-pane-resize-handle:hover .record-right-pane-resize-grip,
.record-right-pane-resize-handle--active .record-right-pane-resize-grip {
  opacity: 1;
  border-color: rgb(229 231 235);
  background: #fff;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.08);
}

.record-right-pane-resize-handle--active .record-right-pane-resize-line {
  background: rgb(99 102 241 / 0.75);
}

.record-right-pane-resize-handle--active .record-right-pane-resize-grip span {
  background: rgb(79 70 229);
}

:global(.dark) .record-right-pane-resize-handle:hover .record-right-pane-resize-grip,
:global(.dark) .record-right-pane-resize-handle--active .record-right-pane-resize-grip {
  border-color: rgb(55 65 81);
  background: rgb(17 24 39);
}

:global(.dark) .record-right-pane-resize-grip span {
  background: rgb(107 114 128);
}

:global(body.record-right-pane-resizing) {
  cursor: col-resize !important;
  user-select: none;
}
</style>
