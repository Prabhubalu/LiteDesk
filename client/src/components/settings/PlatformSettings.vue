<template>
  <div class="space-y-6">
    <!-- Header with Sub-tabs -->
    <div>
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.settingsPlatformTitle') }}</h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.settingsPlatformSubtitle') }}</p>
      
      <!-- Sub-tabs -->
      <div class="mt-4 border-b border-gray-200 dark:border-gray-700">
        <nav class="-mb-px flex space-x-8">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="[
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600',
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors'
            ]"
          >
            {{ tab.name }}
          </button>
        </nav>
      </div>
    </div>

    <!-- Tab Content -->
    <div>
      <component :is="currentTabComponent" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import CoreEntities from './CoreEntities.vue';

const { t } = useI18n();

const activeTab = ref('core-entities');

const tabs = computed(() => [
  { id: 'core-entities', name: t('settings.settingsPlatformTabCoreEntities'), component: CoreEntities }
]);

const currentTabComponent = computed(() => {
  const tab = tabs.value.find((item) => item.id === activeTab.value);
  return tab?.component || tabs.value[0].component;
});
</script>
