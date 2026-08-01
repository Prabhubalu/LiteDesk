<template>
  <PortalPageShell
    :title="deal?.name || t('records.portalDealsTitle')"
    :subtitle="t('records.portalDealsDetailHint')"
    :error="error"
    :back-label="t('records.portalDealsBack')"
    @back="router.push({ name: 'portal-deal-list' })"
  >
    <div v-if="loading" class="h-48" :class="PLATFORM_HOME_SKELETON_CLASS" />
    <div v-else-if="deal" :class="['rounded-2xl p-5 sm:p-6', PLATFORM_HOME_CARD_CLASS]">
      <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-neutral-500">{{ t('records.portalDealsAmount') }}</dt>
          <dd class="mt-1 text-lg font-semibold tabular-nums text-neutral-900 dark:text-white">
            {{ formatMoney(deal.amount, deal.currency) }}
          </dd>
        </div>
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-neutral-500">{{ t('records.portalDealsStage') }}</dt>
          <dd class="mt-1 text-sm text-neutral-900 dark:text-white">{{ deal.stage }}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-neutral-500">{{ t('records.status') }}</dt>
          <dd class="mt-1 text-sm text-neutral-900 dark:text-white">{{ deal.status }}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-neutral-500">{{ t('records.portalDealsProbability') }}</dt>
          <dd class="mt-1 text-sm text-neutral-900 dark:text-white">{{ deal.probability }}%</dd>
        </div>
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-neutral-500">{{ t('records.portalDealsCloseDateLabel') }}</dt>
          <dd class="mt-1 text-sm text-neutral-900 dark:text-white">{{ formatDate(deal.expectedCloseDate) }}</dd>
        </div>
        <div v-if="deal.pipeline">
          <dt class="text-xs font-medium uppercase tracking-wide text-neutral-500">{{ t('records.portalDealsPipeline') }}</dt>
          <dd class="mt-1 text-sm text-neutral-900 dark:text-white">{{ deal.pipeline }}</dd>
        </div>
      </dl>
      <p v-if="deal.description" class="mt-5 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        {{ deal.description }}
      </p>
    </div>
  </PortalPageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import portalApiClient from '@/utils/portalApiClient';
import PortalPageShell from '@/components/portal/PortalPageShell.vue';
import { PLATFORM_HOME_CARD_CLASS, PLATFORM_HOME_SKELETON_CLASS } from '@/utils/platformHomeLayout';
import { formatUserDate } from '@/utils/localeFormat';
import { formatCurrencyValue } from '@/utils/currencyOptions';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const loading = ref(true);
const error = ref(null);
const deal = ref(null);

function formatDate(value) {
  if (!value) return '—';
  return formatUserDate(value) || '—';
}

function formatMoney(amount, currency = 'USD') {
  return formatCurrencyValue(amount, { currencyCode: currency || undefined }) ?? '—';
}

async function loadDeal() {
  loading.value = true;
  error.value = null;
  try {
    const res = await portalApiClient.get(`/deals/${route.params.id}`);
    deal.value = res?.data || null;
  } catch (err) {
    error.value = err.response?.data?.message || err.message || t('records.portalDealsLoadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(loadDeal);
</script>
