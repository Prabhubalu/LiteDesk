<template>
  <nav
    class="record-context-tabs"
    role="tablist"
    aria-orientation="vertical"
    :aria-label="t('records.contextTabsAria')"
  >
    <button
      v-for="tab in tabs"
      :key="tab.key"
      :id="`tab-${tab.key}`"
      :aria-selected="activeTab === tab.key"
      :aria-controls="`panel-${tab.key}`"
      role="tab"
      :tabindex="activeTab === tab.key ? 0 : -1"
      @click="$emit('change', tab.key)"
      @keydown.up.prevent="focusPreviousTab"
      @keydown.down.prevent="focusNextTab"
      @keydown.enter.prevent="$emit('change', tab.key)"
      :class="[
        'record-context-tabs__button',
        activeTab === tab.key ? 'record-context-tabs__button--active' : ''
      ]"
      :title="tab.label"
    >
      <!-- SVG path string -->
      <svg
        v-if="typeof tab.icon === 'string'"
        class="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          :d="tab.icon"
        />
      </svg>
      <!-- Component -->
      <component
        v-else-if="tab.icon"
        :is="tab.icon"
        class="w-5 h-5"
      />
      <!-- Fallback: first letter -->
      <span v-else class="w-5 h-5 flex items-center justify-center text-xs font-medium">
        {{ tab.label.charAt(0).toUpperCase() }}
      </span>
    </button>
  </nav>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

/**
 * RecordContextTabs – vertical tab rail for context panel.
 * 
 * Renders icon-only vertical tabs on the extreme right.
 * No content rendering. No business logic.
 * Keyboard navigable (up/down + enter).
 */
const props = defineProps({
  tabs: {
    type: Array,
    required: true,
    validator: (tabs) => Array.isArray(tabs) && tabs.every(t => t && typeof t.key === 'string' && typeof t.label === 'string')
  },
  activeTab: {
    type: String,
    required: true
  }
});

defineEmits(['change']);

const tabButtons = ref([]);

const focusPreviousTab = () => {
  const currentIndex = props.tabs.findIndex(t => t.key === props.activeTab);
  if (currentIndex > 0) {
    const prevTab = props.tabs[currentIndex - 1];
    document.getElementById(`tab-${prevTab.key}`)?.focus();
  }
};

const focusNextTab = () => {
  const currentIndex = props.tabs.findIndex(t => t.key === props.activeTab);
  if (currentIndex < props.tabs.length - 1) {
    const nextTab = props.tabs[currentIndex + 1];
    document.getElementById(`tab-${nextTab.key}`)?.focus();
  }
};
</script>

<style scoped>
.record-context-tabs {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem 0;
  border-left: 1px solid rgb(229 231 235);
}

:global(.dark) .record-context-tabs {
  border-left-color: rgb(55 65 81);
}

.record-context-tabs__button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: none;
  background: transparent;
  color: rgb(107 114 128);
  cursor: pointer;
  border-radius: 0.375rem;
  transition: all 0.15s ease;
  outline: none;
}

:global(.dark) .record-context-tabs__button {
  color: rgb(156 163 175);
}

.record-context-tabs__button:hover {
  background-color: rgb(243 244 246);
  color: rgb(55 65 81);
}

:global(.dark) .record-context-tabs__button:hover {
  background-color: rgb(55 65 81);
  color: rgb(209 213 219);
}

.record-context-tabs__button:focus-visible {
  outline: 2px solid rgb(99 102 241);
  outline-offset: 2px;
}

.record-context-tabs__button--active {
  background-color: rgb(243 244 246);
  color: rgb(17 24 39);
}

:global(.dark) .record-context-tabs__button--active {
  background-color: rgb(55 65 81);
  color: rgb(243 244 246);
}

.record-context-tabs__button--active:hover {
  background-color: rgb(229 231 235);
}

:global(.dark) .record-context-tabs__button--active:hover {
  background-color: rgb(75 85 99);
}
</style>
