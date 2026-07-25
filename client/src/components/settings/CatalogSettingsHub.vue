<template>
  <SettingsScrollPanel content-class="max-w-5xl">
    <template #header>
      <SettingsPageHeader
        :title="t('settings.catalogHubTitle')"
        :subtitle="t('settings.catalogHubDesc')"
      />
    </template>

    <template #tabs>
      <nav class="flex gap-2 overflow-x-auto -mb-px">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap"
          :class="activeTab === tab.id
            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
          @click="setActiveTab(tab.id)"
        >
          {{ t(tab.labelKey) }}
        </button>
      </nav>
    </template>

    <CatalogCategoriesSettings v-if="activeTab === 'categories'" embedded />
    <CatalogPriceBooksSettings v-else-if="activeTab === 'price-books'" key="catalog-price-books" />
    <ItemGroupsSettings v-else-if="activeTab === 'item-groups'" key="catalog-item-groups" />
  </SettingsScrollPanel>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import SettingsPageHeader from '@/components/settings/SettingsPageHeader.vue';
import CatalogCategoriesSettings from '@/components/settings/CatalogCategoriesSettings.vue';
import CatalogPriceBooksSettings from '@/components/settings/CatalogPriceBooksSettings.vue';
import ItemGroupsSettings from '@/components/settings/ItemGroupsSettings.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const tabs = [
  { id: 'categories', labelKey: 'settings.catalogTabCategories' },
  { id: 'price-books', labelKey: 'settings.catalogTabPriceBooks' },
  { id: 'item-groups', labelKey: 'settings.catalogTabItemGroups' },
];

const VALID_TABS = new Set(tabs.map((tab) => tab.id));

const activeTab = computed(() => {
  const view = String(route.query.catalogView || '');
  return VALID_TABS.has(view) ? view : 'categories';
});

function setActiveTab(id) {
  const query = { ...route.query, tab: 'catalog' };
  if (id === 'categories') {
    delete query.catalogView;
  } else {
    query.catalogView = id;
  }
  router.push({ path: '/settings', query });
}
</script>
