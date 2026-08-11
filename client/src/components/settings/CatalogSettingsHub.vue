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
    <div
      v-else-if="activeTab === 'pricing' && !cpqEntitled"
      class="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20"
    >
      <h3 class="text-base font-semibold text-amber-950 dark:text-amber-100">
        {{ t('settings.addonsCpqRequiredTitle') }}
      </h3>
      <p class="mt-2 text-sm text-amber-900 dark:text-amber-200">
        {{ t('settings.addonsCpqRequiredBody') }}
      </p>
      <button
        type="button"
        class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="goInstallCpq"
      >
        {{ t('settings.addonsCpqRequiredCta') }}
      </button>
    </div>
    <PricingEngineSettings v-else-if="activeTab === 'pricing'" key="catalog-pricing" />
    <div
      v-else-if="activeTab === 'item-groups' && !cpqEntitled"
      class="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20"
    >
      <h3 class="text-base font-semibold text-amber-950 dark:text-amber-100">
        {{ t('settings.addonsCpqRequiredTitle') }}
      </h3>
      <p class="mt-2 text-sm text-amber-900 dark:text-amber-200">
        {{ t('settings.addonsCpqRequiredBody') }}
      </p>
      <button
        type="button"
        class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="goInstallCpq"
      >
        {{ t('settings.addonsCpqRequiredCta') }}
      </button>
    </div>
    <ItemGroupsSettings v-else-if="activeTab === 'item-groups'" key="catalog-item-groups" />
    <div
      v-else-if="activeTab === 'product-configurations' && !cpqEntitled"
      class="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20"
    >
      <h3 class="text-base font-semibold text-amber-950 dark:text-amber-100">
        {{ t('settings.addonsCpqRequiredTitle') }}
      </h3>
      <p class="mt-2 text-sm text-amber-900 dark:text-amber-200">
        {{ t('settings.addonsCpqRequiredBody') }}
      </p>
      <button
        type="button"
        class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="goInstallCpq"
      >
        {{ t('settings.addonsCpqRequiredCta') }}
      </button>
    </div>
    <ProductConfigurationsSettings
      v-else-if="activeTab === 'product-configurations'"
      key="catalog-product-configurations"
    />
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
import PricingEngineSettings from '@/components/settings/PricingEngineSettings.vue';
import ItemGroupsSettings from '@/components/settings/ItemGroupsSettings.vue';
import ProductConfigurationsSettings from '@/components/settings/ProductConfigurationsSettings.vue';
import { useAuthStore } from '@/stores/authRegistry';
import { isCpqAddonEntitled } from '@/utils/addonEntitlement';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const cpqEntitled = computed(() => isCpqAddonEntitled(authStore.user));

const tabs = computed(() => {
  const base = [
    { id: 'categories', labelKey: 'settings.catalogTabCategories' },
    { id: 'price-books', labelKey: 'settings.catalogTabPriceBooks' },
    { id: 'pricing', labelKey: 'settings.catalogTabPricing' },
  ];
  // Always show CPQ tabs so users can discover install CTA when CPQ is missing.
  base.push({ id: 'item-groups', labelKey: 'settings.catalogTabItemGroups' });
  base.push({ id: 'product-configurations', labelKey: 'settings.catalogTabProductConfigs' });
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

function goInstallCpq() {
  router.push({ path: '/settings', query: { tab: 'addons' } });
}
</script>
