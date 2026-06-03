<template>
  <section v-if="record?._id" class="space-y-3">
    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">{{ t('states.loading') }}</div>
    <div
      v-else-if="error"
      class="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-800 dark:text-red-200"
    >
      {{ error }}
    </div>

    <div v-else class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
      <div v-if="!conversions.length" class="text-sm text-gray-600 dark:text-gray-300 space-y-1">
        <p>{{ t('records.conversionNotYet') }}</p>
        <p v-if="!eligibility.allowed" class="text-xs text-gray-500 dark:text-gray-400">
          {{ conversionHint }}
        </p>
        <p
          v-else-if="eligibility.suggestedConversionType === 'partial'"
          class="text-xs text-violet-700 dark:text-violet-300"
        >
          {{ partialAcceptSummary }}
        </p>
      </div>
      <div v-else class="space-y-3 text-sm">
        <div
          v-for="(item, idx) in conversions"
          :key="item._id || idx"
          class="rounded-md border border-gray-100 dark:border-gray-800 p-2 space-y-2"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div class="flex items-center justify-between gap-3">
            <div class="text-gray-500 dark:text-gray-400">{{ t('records.conversionStatus') }}</div>
            <div class="font-medium text-gray-900 dark:text-gray-100">{{ item.status || '—' }}</div>
          </div>
          <div class="flex items-center justify-between gap-3">
            <div class="text-gray-500 dark:text-gray-400">{{ t('records.conversionConvertedAt') }}</div>
            <div class="font-medium text-gray-900 dark:text-gray-100">{{ fmtDate(item.convertedAt) }}</div>
          </div>
          <div class="flex items-center justify-between gap-3">
            <div class="text-gray-500 dark:text-gray-400">{{ t('records.conversionType') }}</div>
            <div class="font-medium text-gray-900 dark:text-gray-100">{{ conversionTypeLabel(item) }}</div>
          </div>
          <div class="flex items-center justify-between gap-3">
            <div class="text-gray-500 dark:text-gray-400">{{ t('records.conversionTargetModule') }}</div>
            <div class="font-medium text-gray-900 dark:text-gray-100">{{ targetModuleLabel(item) }}</div>
          </div>
          <div
            v-if="item.targetExternalRef"
            class="flex items-center justify-between gap-3 md:col-span-2"
          >
            <div class="text-gray-500 dark:text-gray-400">{{ t('records.conversionExternalRef') }}</div>
            <div class="font-medium text-gray-900 dark:text-gray-100 font-mono text-xs break-all">
              {{ item.targetExternalRef }}
            </div>
          </div>
          <div class="flex items-center justify-between gap-3 md:col-span-2">
            <div class="text-gray-500 dark:text-gray-400">{{ t('records.conversionTargetRecord') }}</div>
            <button
              v-if="salesOrderRoute(item)"
              type="button"
              class="font-medium text-indigo-600 dark:text-indigo-400 hover:underline text-xs text-left"
              @click="openSalesOrder(item)"
            >
              {{ targetRecordLabel(item) }}
            </button>
            <div v-else class="font-medium text-gray-900 dark:text-gray-100 text-xs">
              {{ targetRecordLabel(item) }}
            </div>
          </div>
        </div>
        </div>
        <p
          v-if="eligibility.eligibleForMoreConversion"
          class="text-xs text-violet-700 dark:text-violet-300"
        >
          {{ partialRemainingSummary }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { conversionHintKey, getQuoteConversionEligibility } from '@/utils/quoteConversionEligibility';
import { formatQuoteMoney } from '@/utils/quoteMoney';

const props = defineProps({
  record: { type: Object, default: null },
  adapter: { type: Object, default: () => ({}) },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();
const router = useRouter();

const loading = ref(false);
const error = ref('');
const conversions = ref([]);
const eligibility = ref({ allowed: false, reason: 'accept_first', suggestedConversionType: null });

const conversionHint = computed(() => {
  const key = conversionHintKey(eligibility.value);
  return t(key);
});

const partialAcceptSummary = computed(() => {
  const ids = props.record?.customerResponse?.acceptedLineIds || [];
  const count = Array.isArray(ids) ? ids.length : 0;
  const total = props.record?.customerResponse?.acceptedGrandTotal;
  const money = total != null ? formatQuoteMoney(total, props.record?.currency) : null;
  return t('records.conversionPartialSummary', { count, total: money || '—' });
});

const partialRemainingSummary = computed(() => {
  const count = Array.isArray(eligibility.value?.unmappedLineIds)
    ? eligibility.value.unmappedLineIds.length
    : 0;
  return t('records.conversionRemainingLines', { count });
});

function conversionTypeLabel(item) {
  const type = String(item?.conversionType || '').toLowerCase();
  if (type === 'partial') return t('records.conversionTypePartial');
  if (type === 'full') return t('records.conversionTypeFull');
  return item?.conversionType || '—';
}

function targetModuleLabel(item) {
  const mod = String(item?.targetModuleKey || '');
  if (mod === 'sales_orders') return t('records.conversionTargetSalesOrder');
  return mod || '—';
}

function targetRecordLabel(item) {
  const number = item?.metadata?.salesOrderNumber;
  const id = item?.targetRecordId || item?.metadata?.salesOrderId;
  if (number && id) return `${number} · ${String(id).slice(-8)}`;
  if (number) return String(number);
  if (id) return String(id);
  return t('records.conversionTargetPending');
}

function salesOrderRoute(item) {
  const mongoId = item?.metadata?.salesOrderMongoId;
  if (mongoId) return { name: 'sales-order-detail', params: { id: String(mongoId) } };
  return null;
}

function openSalesOrder(item) {
  const route = salesOrderRoute(item);
  if (!route) return;
  router.push(route);
}

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

async function load() {
  if (!props.record?._id) return;
  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient.get(`/quotes/${props.record._id}/conversion`);
    if (!res?.success) {
      error.value = res?.message || t('records.conversionLoadFailed');
      conversions.value = [];
      eligibility.value = getQuoteConversionEligibility(props.record);
      return;
    }
    conversions.value = Array.isArray(res?.data?.conversions)
      ? res.data.conversions
      : res?.data?.conversion
        ? [res.data.conversion]
        : [];
    eligibility.value = res?.data?.eligibility || getQuoteConversionEligibility(props.record);
  } catch (e) {
    error.value = e?.message || t('records.conversionLoadFailed');
    conversions.value = [];
    eligibility.value = getQuoteConversionEligibility(props.record);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => String(props.record?._id || ''), () => load());
watch(
  () => [props.record?.converted, props.record?.conversionStatus, props.record?.status],
  () => load()
);
</script>
