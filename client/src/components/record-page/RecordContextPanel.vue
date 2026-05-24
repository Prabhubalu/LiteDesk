<template>
  <div class="record-context-panel flex flex-col flex-1 min-h-0">
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
import { ref, watch } from 'vue';
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
  scrollbar-gutter: stable;
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
