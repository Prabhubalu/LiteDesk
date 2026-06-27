<template>
  <PortalPageShell
    :title="t('records.portalDealsTitle')"
    :subtitle="t('records.portalDealsHint')"
    :error="error"
  >
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-24" :class="PLATFORM_HOME_SKELETON_CLASS" />
    </div>
    <div
      v-else-if="!deals.length"
      :class="['p-10 text-center sm:p-12', PLATFORM_HOME_CARD_CLASS]"
    >
      <h3 class="text-lg font-medium text-neutral-900 dark:text-white">{{ t('records.portalDealsEmpty') }}</h3>
    </div>

    <div v-else class="space-y-3">
      <router-link
        v-for="deal in deals"
        :key="deal._id"
        :to="{ name: 'portal-deal-detail', params: { id: deal._id } }"
        class="block rounded-2xl p-4 transition-colors hover:border-primary-200 dark:hover:border-primary-500/30"
        :class="PLATFORM_HOME_CARD_CLASS"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-base font-semibold text-neutral-900 dark:text-white">{{ deal.name }}</p>
            <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{{ deal.stage }}</p>
          </div>
          <p class="shrink-0 text-sm font-semibold tabular-nums text-neutral-900 dark:text-white">
            {{ formatMoney(deal.amount, deal.currency) }}
          </p>
        </div>
        <p class="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          {{ t('records.portalDealsCloseDate', { date: formatDate(deal.expectedCloseDate) }) }}
        </p>
      </router-link>
    </div>
  </PortalPageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import portalApiClient from '@/utils/portalApiClient';
import PortalPageShell from '@/components/portal/PortalPageShell.vue';
import { PLATFORM_HOME_CARD_CLASS, PLATFORM_HOME_SKELETON_CLASS } from '@/utils/platformHomeLayout';

const { t } = useI18n();
const loading = ref(true);
const error = ref(null);
const deals = ref([]);

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatMoney(amount, currency = 'USD') {
  return (Number(amount) || 0).toLocaleString(undefined, {
    style: 'currency',
    currency: currency || 'USD'
  });
}

async function loadDeals() {
  loading.value = true;
  error.value = null;
  try {
    const res = await portalApiClient.get('/deals');
    deals.value = Array.isArray(res?.data) ? res.data : [];
  } catch (err) {
    error.value = err.response?.data?.message || err.message || t('records.portalDealsLoadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(loadDeals);
</script>
