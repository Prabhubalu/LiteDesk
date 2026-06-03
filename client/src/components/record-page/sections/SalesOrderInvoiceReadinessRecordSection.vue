<template>
  <section v-if="record?._id" class="space-y-3 text-sm">
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.salesOrderInvoiceReadinessHintLive') }}</p>
      <button
        v-if="canCreateInvoice"
        type="button"
        class="inline-flex items-center rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
        :disabled="loading || !hasBillableLines"
        @click="showModal = true"
      >
        {{ t('records.salesOrderCreateInvoiceAction') }}
      </button>
    </div>

    <div v-if="loading" class="text-gray-500 dark:text-gray-400">{{ t('states.loading') }}</div>
    <template v-else-if="summary">
      <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table class="min-w-full text-sm">
          <thead class="text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60">
            <tr>
              <th class="px-3 py-2 text-left">{{ t('records.linesName') }}</th>
              <th class="px-3 py-2 text-right">{{ t('records.salesOrderQtyFulfilled') }}</th>
              <th class="px-3 py-2 text-right">{{ t('records.salesOrderQtyInvoiced') }}</th>
              <th class="px-3 py-2 text-right">{{ t('records.salesOrderQtyRemainingInvoice') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="line in summary.lines || []"
              :key="line.salesOrderLineId"
              class="border-t border-gray-100 dark:border-gray-800"
            >
              <td class="px-3 py-2">
                <div>{{ line.itemNameSnapshot || line.salesOrderLineId }}</div>
              </td>
              <td class="px-3 py-2 text-right tabular-nums">{{ line.quantityFulfilled }}</td>
              <td class="px-3 py-2 text-right tabular-nums">{{ line.quantityInvoiced }}</td>
              <td class="px-3 py-2 text-right tabular-nums">{{ line.quantityRemainingToInvoice }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!hasBillableLines" class="text-xs text-amber-600 dark:text-amber-400">
        {{ t('records.salesOrderNoBillableLines') }}
      </p>
    </template>

    <SalesOrderCreateInvoiceModal
      :open="showModal"
      :record="record"
      :summary="summary"
      @close="showModal = false"
      @created="handleInvoiceCreated"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/auth';
import SalesOrderCreateInvoiceModal from '@/components/record-page/sections/SalesOrderCreateInvoiceModal.vue';

const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();
const auth = useAuthStore();
const loading = ref(false);
const summary = ref(null);
const showModal = ref(false);

const blockedStatuses = new Set(['Cancelled', 'Closed']);

const canCreateInvoice = computed(() => {
  if (blockedStatuses.has(String(props.record?.status || '').trim())) return false;
  if (auth.isOwner) return true;
  const perms = auth.user?.permissions?.invoices || auth.user?.permissions?.sales_orders;
  return perms?.create === true || perms?.invoice === true;
});

const hasBillableLines = computed(() =>
  (summary.value?.lines || []).some((line) => Number(line.quantityRemainingToInvoice) > 0)
);

async function loadSummary() {
  if (!props.record?._id) return;
  loading.value = true;
  try {
    const res = await apiClient.get(`/sales-orders/${props.record._id}/invoice-readiness`);
    summary.value = res?.success ? res.data : null;
  } catch {
    summary.value = null;
  } finally {
    loading.value = false;
  }
}

function handleInvoiceCreated() {
  loadSummary();
  if (typeof props.context?.onSectionUpdated === 'function') {
    props.context.onSectionUpdated({
      sectionKey: 'billing',
      payload: { type: 'billing-refresh' }
    });
    props.context.onSectionUpdated({
      sectionKey: 'invoice',
      payload: { type: 'invoice-refresh' }
    });
  }
}

onMounted(loadSummary);
watch(() => String(props.record?._id || ''), loadSummary);
watch(
  () => props.context?.billingRefreshToken,
  () => loadSummary()
);
</script>
