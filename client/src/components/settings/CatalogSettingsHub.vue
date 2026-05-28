<template>
  <div class="space-y-6 max-w-5xl">
    <div>
      <button type="button" class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mb-2" @click="$emit('back')">
        {{ t('actions.back') }}
      </button>
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.catalogHubTitle') }}</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ t('settings.catalogHubDesc') }}</p>
    </div>

    <nav class="flex gap-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
        :class="activeTab === tab.id
          ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
        @click="activeTab = tab.id"
      >
        {{ t(tab.labelKey) }}
      </button>
    </nav>

    <CatalogCategoriesSettings v-if="activeTab === 'categories'" embedded @back="$emit('back')" />
    <CatalogPriceBooksSettings v-else-if="activeTab === 'price-books'" key="catalog-price-books" />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import CatalogCategoriesSettings from '@/components/settings/CatalogCategoriesSettings.vue';
import CatalogPriceBooksSettings from '@/components/settings/CatalogPriceBooksSettings.vue';

defineEmits(['back']);

const { t } = useI18n();

const tabs = [
  { id: 'categories', labelKey: 'settings.catalogTabCategories' },
  { id: 'price-books', labelKey: 'settings.catalogTabPriceBooks' }
];

const activeTab = ref('categories');
</script>
