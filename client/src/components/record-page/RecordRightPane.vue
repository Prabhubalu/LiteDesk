<template>
  <div 
    :class="[
      'record-right-pane flex min-w-0 flex-col h-full bg-white dark:bg-gray-900 overflow-hidden transition-all duration-300',
      fullWidth || layoutIsMobile
        ? 'w-full flex-1'
        : activeTab
          ? 'w-full lg:w-[500px]'
          : 'w-20'
    ]"
  >
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
              'text-xs font-medium leading-tight text-center',
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
  UserGroupIcon
} from '@heroicons/vue/24/outline';

const { t } = useI18n();

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

// Initialize activeTab with priority: defaultTab prop > persisted > null
const initialTab = props.defaultTab || loadPersistedTab() || null;
const activeTab = ref(initialTab);
const scrollContainer = ref(null);

// Load persisted tab on mount if not provided via prop
onMounted(() => {
  if (!props.defaultTab && !activeTab.value) {
    const persisted = loadPersistedTab();
    if (persisted) {
      activeTab.value = persisted;
    }
  }
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
  layoutSummaryTeleportReady.value = false;
});

// Watch for defaultTab changes
watch(() => props.defaultTab, (newTab) => {
  if (newTab) {
    activeTab.value = newTab;
  } else {
    // Only clear if there's no persisted value
    const persisted = loadPersistedTab();
    activeTab.value = persisted || null;
  }
});

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
    'summary': Squares2X2Icon,
    'details': DocumentTextIcon,
    'updates': ClockIcon,
    'comments': ChatBubbleLeftRightIcon,
    'timeline': ClockIcon,
    'related': LinkIcon,
    'integrations': PuzzlePieceIcon,
    'knowledge': BookOpenIcon,
    'email': EnvelopeIcon,
    'participants': UserGroupIcon,
    'details': DocumentTextIcon
  };
  return iconMap[tabId] || RectangleStackIcon;
};
</script>

<style scoped>
/* Custom scrollbar styling */
.record-right-pane :deep(.overflow-y-auto)::-webkit-scrollbar {
  width: 8px;
}

.record-right-pane :deep(.overflow-y-auto)::-webkit-scrollbar-track {
  background: transparent;
}

.record-right-pane :deep(.overflow-y-auto)::-webkit-scrollbar-thumb {
  background: rgb(203 213 225);
  border-radius: 4px;
}

:global(.dark) .record-right-pane :deep(.overflow-y-auto)::-webkit-scrollbar-thumb {
  background: rgb(75 85 99);
}

/* Summary content spacing (teleported from RecordPageLayout) */
.record-right-pane__summary-content > * + * {
  margin-top: 0.75rem;
}
</style>
