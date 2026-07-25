<template>
  <SettingsScrollPanel v-if="currentView === 'overview'">
    <template #header>
      <SettingsPageHeader
        :title="t('settings.tabInventory')"
        :subtitle="t('settings.inventoryHubDesc')"
      />
    </template>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="option in inventoryOptions"
        :key="option.id"
        :class="[
          SETTINGS_OVERVIEW_CARD_CLASS,
          'group',
          option.disabled && 'cursor-not-allowed opacity-60 hover:border-neutral-200 dark:hover:border-neutral-700',
        ]"
        @click="navigateToOption(option)"
      >
        <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 dark:group-hover:bg-primary-900/30">
          <component :is="option.icon" class="h-5 w-5" />
        </div>
        <h3 :class="[SETTINGS_SECTION_TITLE_CLASS, 'mb-1.5']">
          {{ t(option.nameKey) }}
        </h3>
        <p class="text-helper text-neutral-600 dark:text-neutral-400">
          {{ t(option.descriptionKey) }}
        </p>
      </div>
    </div>
  </SettingsScrollPanel>

  <TaxSettingsHub
    v-else-if="currentView === 'taxes'"
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
    @back="navigateToOverview"
  />
  <ChargeSettingsHub
    v-else-if="currentView === 'charges'"
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
    @back="navigateToOverview"
  />
</template>

<script setup>
import { computed, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import SettingsPageHeader from '@/components/settings/SettingsPageHeader.vue';
import TaxSettingsHub from '@/components/settings/TaxSettingsHub.vue';
import ChargeSettingsHub from '@/components/settings/ChargeSettingsHub.vue';
import {
  SETTINGS_OVERVIEW_CARD_CLASS,
  SETTINGS_SECTION_TITLE_CLASS,
} from '@/components/settings/settingsSaveBar';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const TaxesIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg',
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M9 7h6m-6 4h6m-6 4h4M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z',
  }),
]);

const ChargesIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg',
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  }),
]);

const inventoryOptions = [
  {
    id: 'taxes',
    nameKey: 'settings.inventoryTaxes',
    descriptionKey: 'settings.inventoryTaxesDesc',
    icon: TaxesIcon,
  },
  {
    id: 'charges',
    nameKey: 'settings.inventoryCharges',
    descriptionKey: 'settings.inventoryChargesDesc',
    icon: ChargesIcon,
  },
];

const currentView = computed(() => {
  const view = String(route.query.inventoryView || '');
  if (view === 'taxes' || view === 'charges') return view;
  return 'overview';
});

function navigateToOverview() {
  const query = { ...route.query, tab: 'inventory' };
  delete query.inventoryView;
  router.push({ path: '/settings', query });
}

function navigateToOption(option) {
  if (option.disabled) return;
  router.push({
    path: '/settings',
    query: { ...route.query, tab: 'inventory', inventoryView: option.id },
  });
}
</script>
