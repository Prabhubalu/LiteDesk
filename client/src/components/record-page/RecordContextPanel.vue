<template>
  <div
    class="record-context-panel flex flex-col flex-1 min-h-0"
    :class="{ 'is-scrolling': isScrolling }"
    @scroll.capture="showScrollbar"
    @wheel.capture="showScrollbar"
    @touchstart.capture="showScrollbar"
  >
    <!-- Content area with tabs -->
    <div class="record-context-panel__body flex flex-1 min-h-0">
      <!-- Tab panels content (left of tab rail) -->
      <div class="record-context-panel__content flex-1 min-w-0 overflow-y-auto">
        <div
          v-for="tab in tabs"
          :key="tab.key"
          :id="`panel-${tab.key}`"
          role="tabpanel"
          :aria-labelledby="`tab-${tab.key}`"
          :aria-hidden="activeTab !== tab.key"
          v-show="activeTab === tab.key"
          class="record-context-panel__panel flex flex-col h-full"
        >
          <slot :name="`tab-${tab.key}`" />
        </div>
      </div>
      
      <!-- Vertical tab rail (extreme right) -->
      <RecordContextTabs
        :tabs="tabs"
        :active-tab="activeTab"
        @change="handleTabChange"
      />
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, watch, onUnmounted } from 'vue';
import RecordContextTabs from './RecordContextTabs.vue';

/**
 * RecordContextPanel – container for right-side contextual tools.
 * 
 * Manages active tab state and renders tab rail + active panel.
 * Each tab can have its own header via slots.
 * No knowledge of Tasks, Deals, etc.
 * No assumptions about tab content.
 * Tabs are identified by keys.
 */
const props = defineProps({
  tabs: {
    type: Array,
    required: true,
    validator: (tabs) => Array.isArray(tabs) && tabs.every(t => t && typeof t.key === 'string' && typeof t.label === 'string')
  },
  defaultTab: {
    type: String,
    default: null
  }
});

const { t } = useI18n();

const activeTab = ref(props.defaultTab || (props.tabs.length > 0 ? props.tabs[0].key : null));
const isScrolling = ref(false);
let scrollHideTimer = null;
const SCROLL_HIDE_DELAY = 800;

function showScrollbar() {
  isScrolling.value = true;
  if (scrollHideTimer) clearTimeout(scrollHideTimer);
  scrollHideTimer = setTimeout(() => {
    isScrolling.value = false;
    scrollHideTimer = null;
  }, SCROLL_HIDE_DELAY);
}

onUnmounted(() => {
  if (scrollHideTimer) clearTimeout(scrollHideTimer);
});

const handleTabChange = (tabKey) => {
  activeTab.value = tabKey;
};

// Watch for defaultTab changes
watch(() => props.defaultTab, (newTab) => {
  if (newTab && props.tabs.some(t => t.key === newTab)) {
    activeTab.value = newTab;
  }
});

// Watch for tabs array changes
watch(() => props.tabs, (newTabs) => {
  if (newTabs.length > 0 && (!activeTab.value || !newTabs.some(t => t.key === activeTab.value))) {
    activeTab.value = newTabs[0].key;
  }
}, { immediate: true });
</script>

<style scoped>
.record-context-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.record-context-panel__body {
  display: flex;
  flex-direction: row;
  flex: 1;
  min-height: 0;
}

.record-context-panel__content {
  padding-right: 0.75rem;
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  scrollbar-color: transparent transparent;
  scrollbar-width: thin;
}

.record-context-panel.is-scrolling .record-context-panel__content {
  scrollbar-color: rgba(0, 0, 0, 0.25) transparent;
}

.record-context-panel__content::-webkit-scrollbar {
  width: 8px;
}

.record-context-panel__content::-webkit-scrollbar-track {
  background: transparent;
}

.record-context-panel__content::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 4px;
}

.record-context-panel.is-scrolling .record-context-panel__content::-webkit-scrollbar-thumb {
  background: rgb(203 213 225);
}

:global(.dark) .record-context-panel.is-scrolling .record-context-panel__content {
  scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
}

:global(.dark) .record-context-panel.is-scrolling .record-context-panel__content::-webkit-scrollbar-thumb {
  background: rgb(75 85 99);
}

.record-context-panel__panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}
</style>

<style>
/* Header style for tab headers (unscoped to work with slot content) */
.record-context-panel__header {
  flex-shrink: 0;
}
</style>
