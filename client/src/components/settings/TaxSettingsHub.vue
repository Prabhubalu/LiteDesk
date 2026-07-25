<template>
  <SettingsScrollPanel content-class="max-w-5xl">
    <template #header>
      <div>
        <button
          type="button"
          class="mb-2 text-sm text-indigo-600 hover:underline dark:text-indigo-400"
          @click="$emit('back')"
        >
          {{ t('actions.back') }}
        </button>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.taxHubTitle') }}</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.taxHubDesc') }}</p>
      </div>
    </template>

    <template #tabs>
      <nav class="-mb-px flex gap-2 overflow-x-auto">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors"
          :class="activeTab === tab.id
            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
          @click="activeTab = tab.id"
        >
          {{ t(tab.labelKey) }}
        </button>
      </nav>
    </template>

    <TaxRatesSettings v-if="activeTab === 'rates'" />
    <TaxGroupsSettings v-else-if="activeTab === 'groups'" />
    <TaxDefaultsSettings v-else-if="activeTab === 'defaults'" />
    <TaxRegionalSettings v-else-if="activeTab === 'regional'" />
  </SettingsScrollPanel>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import TaxRatesSettings from '@/components/settings/TaxRatesSettings.vue';
import TaxGroupsSettings from '@/components/settings/TaxGroupsSettings.vue';
import TaxDefaultsSettings from '@/components/settings/TaxDefaultsSettings.vue';
import TaxRegionalSettings from '@/components/settings/TaxRegionalSettings.vue';

defineEmits(['back']);

const { t } = useI18n();

const tabs = [
  { id: 'rates', labelKey: 'settings.taxTabRates' },
  { id: 'groups', labelKey: 'settings.taxTabGroups' },
  { id: 'defaults', labelKey: 'settings.taxTabDefaults' },
  { id: 'regional', labelKey: 'settings.taxTabRegional' }
];

const activeTab = ref('rates');
</script>
