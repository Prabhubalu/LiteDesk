<template>
  <section v-if="record?._id" class="space-y-3 text-sm">
    <div v-if="!canFulfill" class="text-xs text-gray-500 dark:text-gray-400">
      {{ fulfillBlockedHint }}
    </div>

    <div v-if="canFulfill && openLines.length" class="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
      <div class="font-medium text-gray-900 dark:text-gray-100">{{ t('records.salesOrderPostFulfillment') }}</div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <label class="block md:col-span-1">
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.salesOrderFulfillmentLine') }}</span>
          <select
            v-model="selectedLineId"
            class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm"
          >
            <option v-for="line in openLines" :key="line.salesOrderLineId" :value="line.salesOrderLineId">
              {{ lineLabel(line) }}
            </option>
          </select>
        </label>
        <label class="block">
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.linesQty') }}</span>
          <input
            v-model.number="quantityDelta"
            type="number"
            min="1"
            class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm"
          />
        </label>
        <label class="block">
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.salesOrderFulfillmentType') }}</span>
          <select
            v-model="fulfillmentType"
            class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm"
          >
            <option
              v-for="type in fulfillmentTypeOptions"
              :key="type"
              :value="type"
            >
              {{ type }}
            </option>
          </select>
        </label>
      </div>
      <button
        type="button"
        class="inline-flex items-center rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
        :disabled="busy || !selectedLineId || !quantityDelta"
        @click="postFulfillment"
      >
        {{ t('records.salesOrderPostFulfillmentAction') }}
      </button>
    </div>

    <div v-if="loading" class="text-gray-500 dark:text-gray-400">{{ t('states.loading') }}</div>
    <div v-else-if="events.length" class="space-y-2">
      <div class="font-medium text-gray-900 dark:text-gray-100">{{ t('records.salesOrderFulfillmentHistory') }}</div>
      <div
        v-for="event in events"
        :key="event._id || event.salesOrderFulfillmentId"
        class="rounded-md border border-gray-100 dark:border-gray-800 px-3 py-2"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <div class="font-medium capitalize">{{ event.fulfillmentType }}</div>
            <span
              v-if="event.status === 'reversed'"
              class="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300"
            >
              {{ t('records.salesOrderFulfillmentReversed') }}
            </span>
            <span
              v-if="event.reversesFulfillmentId"
              class="text-[10px] uppercase tracking-wide text-violet-700 dark:text-violet-300"
            >
              {{ t('records.salesOrderFulfillmentReversal') }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="canReverse(event)"
              type="button"
              class="text-xs text-red-600 hover:text-red-700 dark:text-red-400 disabled:opacity-50"
              :disabled="busyReverseId === (event.salesOrderFulfillmentId || event._id)"
              @click="reverseEvent(event)"
            >
              {{ t('records.salesOrderFulfillmentReverse') }}
            </button>
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ fmtDate(event.fulfilledAt || event.createdAt) }}</div>
          </div>
        </div>
        <div class="text-xs text-gray-600 dark:text-gray-300 mt-1">
          {{ t('records.salesOrderFulfillmentLineCount', { count: event.lines?.length || 0 }) }}
          <span v-if="event.trackingNumber"> · {{ event.trackingNumber }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { useAuthStore } from '@/stores/authRegistry';
import { getSalesOrderFulfillmentEventTypes } from '@/utils/inventoryCapability';

const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();
const notifications = useNotifications();
const authStore = useAuthStore();

const fulfillmentTypeOptions = computed(() =>
  [...getSalesOrderFulfillmentEventTypes(authStore.inventoryEnabled)]
);

const loading = ref(false);
const busy = ref(false);
const busyReverseId = ref('');
const events = ref([]);
const selectedLineId = ref('');
const quantityDelta = ref(1);
const fulfillmentType = ref('complete');

watch(
  fulfillmentTypeOptions,
  (options) => {
    if (!options.length) return;
    if (!options.includes(fulfillmentType.value)) {
      fulfillmentType.value = options[0];
    }
  },
  { immediate: true }
);

const FULFILLABLE_STATUSES = new Set(['Confirmed', 'In Fulfillment', 'Partially Fulfilled', 'Fulfilled']);

const canFulfill = computed(() => FULFILLABLE_STATUSES.has(String(props.record?.status || '')));

const fulfillBlockedHint = computed(() => {
  const status = String(props.record?.status || '');
  if (status === 'Draft') return t('records.salesOrderFulfillmentDraftHint');
  if (status === 'On Hold') return t('records.salesOrderFulfillmentOnHoldHint');
  return t('records.salesOrderFulfillmentBlockedHint');
});

const openLines = computed(() => {
  const lines = Array.isArray(props.record?.lines) ? props.record.lines : [];
  return lines.filter((line) => {
    if (!line || line.hiddenLine) return false;
    if (String(line.lineType || '') === 'bundle_component') return false;
    const qty = Number(line.quantity) || 0;
    const fulfilled = Number(line.quantityFulfilled) || 0;
    const cancelled = Number(line.quantityCancelled) || 0;
    return qty - fulfilled - cancelled > 0;
  });
});

watch(
  openLines,
  (lines) => {
    if (!selectedLineId.value && lines.length) {
      selectedLineId.value = lines[0].salesOrderLineId;
    }
  },
  { immediate: true }
);

function lineLabel(line) {
  const name = line.itemNameSnapshot || line.skuSnapshot || line.salesOrderLineId;
  const open =
    (Number(line.quantity) || 0) -
    (Number(line.quantityFulfilled) || 0) -
    (Number(line.quantityCancelled) || 0);
  return `${name} (${open} open)`;
}

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

async function loadEvents() {
  if (!props.record?._id) return;
  loading.value = true;
  try {
    const res = await apiClient.get(`/sales-orders/${props.record._id}/fulfillments`);
    events.value = res?.success && Array.isArray(res.data) ? res.data : [];
  } catch {
    events.value = [];
  } finally {
    loading.value = false;
  }
}

async function postFulfillment() {
  if (!props.record?._id || !selectedLineId.value || !quantityDelta.value) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/sales-orders/${props.record._id}/fulfillments`, {
      fulfillmentType: fulfillmentType.value,
      lines: [{ salesOrderLineId: selectedLineId.value, quantityDelta: Number(quantityDelta.value) }]
    });
    if (!res?.success) {
      notifications.error(res?.message || t('records.salesOrderFulfillmentFailed'));
      return;
    }
    notifications.success(t('records.salesOrderFulfillmentSuccess'));
    emitSoftRefresh(res?.data);
    await loadEvents();
  } catch (e) {
    notifications.error(e?.message || t('records.salesOrderFulfillmentFailed'));
  } finally {
    busy.value = false;
  }
}

function canReverse(event) {
  if (!canFulfill.value || !event) return false;
  if (String(event.status || '') !== 'posted') return false;
  if (event.reversesFulfillmentId) return false;
  if (event.reversedByFulfillmentId) return false;
  return String(event.fulfillmentType || '') !== 'progress';
}

function emitSoftRefresh(data) {
  if (typeof props.context?.onSectionUpdated !== 'function') return;
  props.context.onSectionUpdated({
    sectionKey: 'fulfillment',
    payload: {
      type: 'soft-refresh',
      salesOrder: data?.salesOrder,
      lines: data?.lines,
      totals: data?.salesOrder
    }
  });
}

async function reverseEvent(event) {
  const fulfillmentId = event?.salesOrderFulfillmentId || event?._id;
  if (!props.record?._id || !fulfillmentId) return;
  if (!window.confirm(t('records.salesOrderFulfillmentReverseConfirm'))) return;

  busyReverseId.value = fulfillmentId;
  try {
    const res = await apiClient.post(
      `/sales-orders/${props.record._id}/fulfillments/${fulfillmentId}/reverse`,
      {}
    );
    if (!res?.success) {
      notifications.error(res?.message || t('records.salesOrderFulfillmentReverseFailed'));
      return;
    }
    notifications.success(t('records.salesOrderFulfillmentReverseSuccess'));
    emitSoftRefresh(res?.data);
    await loadEvents();
  } catch (e) {
    notifications.error(e?.message || t('records.salesOrderFulfillmentReverseFailed'));
  } finally {
    busyReverseId.value = '';
  }
}

onMounted(loadEvents);
watch(() => String(props.record?._id || ''), loadEvents);
</script>
