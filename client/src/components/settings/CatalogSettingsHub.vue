<template>
  <SettingsScrollPanel content-class="max-w-5xl">
    <template #header>
      <SettingsPageHeader
        :title="t('settings.catalogHubTitle')"
        :subtitle="hubSubtitle"
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
    <CatalogPriceBooksSettings
      v-else-if="activeTab === 'price-books' && cpqEntitled"
      key="catalog-price-books"
    />
    <PricingEngineSettings
      v-else-if="activeTab === 'pricing' && cpqEntitled"
      key="catalog-pricing"
    />
    <ItemGroupsSettings
      v-else-if="activeTab === 'item-groups' && cpqEntitled"
      key="catalog-item-groups"
    />
    <ProductConfigurationsSettings
      v-else-if="activeTab === 'product-configurations' && cpqEntitled"
      key="catalog-product-configurations"
    />
  </SettingsScrollPanel>
</template>

<script setup>
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import SettingsPageHeader from '@/components/settings/SettingsPageHeader.vue';
import CatalogCategoriesSettings from '@/components/settings/CatalogCategoriesSettings.vue';
import CatalogPriceBooksSettings from '@/components/settings/CatalogPriceBooksSettings.vue';
import PricingEngineSettings from '@/components/settings/PricingEngineSettings.vue';
import ItemGroupsSettings from '@/components/settings/ItemGroupsSettings.vue';
import ProductConfigurationsSettings from '@/components/settings/ProductConfigurationsSettings.vue';
import { useAuthStore } from '@/stores/authRegistry';
import { isCpqAddonEntitled } from '@/utils/addonEntitlement';

const CPQ_TAB_IDS = new Set([
  'price-books',
  'pricing',
  'item-groups',
  'product-configurations',
]);

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const cpqEntitled = computed(() => isCpqAddonEntitled(authStore.user));

const hubSubtitle = computed(() =>
  cpqEntitled.value
    ? t('settings.catalogHubDesc')
    : t('settings.catalogHubDescCore')
);

const tabs = computed(() => {
  const base = [
    { id: 'categories', labelKey: 'settings.catalogTabCategories' },
  ];
  if (cpqEntitled.value) {
    base.push(
      { id: 'price-books', labelKey: 'settings.catalogTabPriceBooks' },
      { id: 'pricing', labelKey: 'settings.catalogTabPricing' },
      { id: 'item-groups', labelKey: 'settings.catalogTabItemGroups' },
      { id: 'product-configurations', labelKey: 'settings.catalogTabProductConfigs' },
    );
  }
  return base;
});

const VALID_TABS = computed(() => new Set(tabs.value.map((tab) => tab.id)));

const activeTab = computed(() => {
  const view = String(route.query.catalogView || '');
  return VALID_TABS.value.has(view) ? view : 'categories';
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

// Drop CPQ deep-links from the URL after uninstall so refresh doesn't re-hit them.
watch(
  [cpqEntitled, () => route.query.catalogView, () => route.query.tab],
  ([entitled, catalogView, tab]) => {
    if (tab !== 'catalog') return;
    const view = String(catalogView || '');
    if (!view || !CPQ_TAB_IDS.has(view)) return;
    if (entitled) return;
    const query = { ...route.query, tab: 'catalog' };
    delete query.catalogView;
    router.replace({ path: '/settings', query });
  },
  { immediate: true }
);
</script>
