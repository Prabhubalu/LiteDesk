<template>
  <section v-if="record?._id" class="space-y-3 text-sm">
    <div v-if="lineageSummary.length" class="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
      <div class="font-medium text-gray-900 dark:text-gray-100">{{ t('records.salesOrderLineageTitle') }}</div>
      <div
        v-for="row in lineageSummary"
        :key="row.key"
        class="flex flex-wrap items-center justify-between gap-2 text-xs"
      >
        <span class="text-gray-500 dark:text-gray-400">{{ row.label }}</span>
        <RouterLink
          v-if="row.href"
          :to="row.href"
          class="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-300"
        >
          {{ row.value }}
        </RouterLink>
        <span v-else class="text-gray-800 dark:text-gray-200">{{ row.value }}</span>
      </div>
    </div>

    <div v-if="canSplit && openLines.length" class="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
      <div class="font-medium text-gray-900 dark:text-gray-100">{{ t('records.salesOrderSplitTitle') }}</div>
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.salesOrderSplitHint') }}</p>
      <div class="space-y-2">
        <label
          v-for="line in openLines"
          :key="line.salesOrderLineId"
          class="flex flex-wrap items-center gap-2 rounded-md border border-gray-100 dark:border-gray-800 px-2 py-1.5"
        >
          <input v-model="selectedLineIds" type="checkbox" :value="line.salesOrderLineId" />
          <span class="flex-1 min-w-[140px]">{{ lineLabel(line) }}</span>
          <input
            v-if="selectedLineIds.includes(line.salesOrderLineId) && line.lineType !== 'bundle_parent'"
            v-model.number="splitQty[line.salesOrderLineId]"
            type="number"
            min="1"
            :max="openQty(line)"
            class="w-20 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-right"
          />
        </label>
      </div>
      <button
        type="button"
        class="inline-flex items-center rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
        :disabled="busy || !selectedLineIds.length"
        @click="submitSplit"
      >
        {{ t('records.salesOrderSplitAction') }}
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';

const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();
const router = useRouter();
const notifications = useNotifications();
const busy = ref(false);
const selectedLineIds = ref([]);
const splitQty = reactive({});

const BLOCKED_SPLIT = new Set(['Cancelled', 'Closed', 'On Hold']);
const BLOCKED_LINEAGE = new Set(['merged_source']);

const canSplit = computed(() => {
  const status = String(props.record?.status || '');
  const lineage = String(props.record?.lineageType || 'standalone');
  return !BLOCKED_SPLIT.has(status) && !BLOCKED_LINEAGE.has(lineage);
});

const openLines = computed(() => {
  const lines = Array.isArray(props.record?.lines) ? props.record.lines : [];
  return lines.filter((line) => {
    if (!line || line.hiddenLine) return false;
    if (String(line.lineType || '') === 'bundle_component') return false;
    return openQty(line) > 0;
  });
});

watch(
  openLines,
  (lines) => {
    for (const line of lines) {
      splitQty[line.salesOrderLineId] = openQty(line);
    }
  },
  { immediate: true }
);

const lineageSummary = computed(() => {
  const rows = [];
  const lineage = props.record?.lineage || {};
  const type = String(props.record?.lineageType || 'standalone');
  if (type !== 'standalone') {
    rows.push({ key: 'type', label: t('records.salesOrderLineageType'), value: type });
  }
  if (lineage.parentOrder) {
    rows.push({
      key: 'parent',
      label: t('records.salesOrderLineageParent'),
      value: lineage.parentOrder.salesOrderNumber || lineage.parentOrder.salesOrderId,
      href: `/sales-orders/${lineage.parentOrder._id || lineage.parentOrder.salesOrderId}`
    });
  }
  for (const child of lineage.childOrders || []) {
    rows.push({
      key: `child-${child.salesOrderId}`,
      label: t('records.salesOrderLineageChild'),
      value: child.salesOrderNumber || child.salesOrderId,
      href: `/sales-orders/${child._id || child.salesOrderId}`
    });
  }
  if (lineage.mergedIntoOrder) {
    rows.push({
      key: 'merged-into',
      label: t('records.salesOrderLineageMergedInto'),
      value: lineage.mergedIntoOrder.salesOrderNumber || lineage.mergedIntoOrder.salesOrderId,
      href: `/sales-orders/${lineage.mergedIntoOrder._id || lineage.mergedIntoOrder.salesOrderId}`
    });
  }
  for (const source of lineage.mergedFromOrders || []) {
    rows.push({
      key: `merged-from-${source.salesOrderId}`,
      label: t('records.salesOrderLineageMergedFrom'),
      value: source.salesOrderNumber || source.salesOrderId,
      href: `/sales-orders/${source._id || source.salesOrderId}`
    });
  }
  return rows;
});

function openQty(line) {
  return Math.max(
    0,
    (Number(line.quantity) || 0) -
      (Number(line.quantityFulfilled) || 0) -
      (Number(line.quantityCancelled) || 0)
  );
}

function lineLabel(line) {
  const name = line.itemNameSnapshot || line.skuSnapshot || line.salesOrderLineId;
  return `${name} (${openQty(line)} open)`;
}

async function submitSplit() {
  if (!props.record?._id || !selectedLineIds.value.length) return;
  busy.value = true;
  try {
    const lines = selectedLineIds.value.map((salesOrderLineId) => {
      const line = openLines.value.find((row) => row.salesOrderLineId === salesOrderLineId);
      const payload = { salesOrderLineId };
      if (line && String(line.lineType || '') !== 'bundle_parent') {
        payload.quantity = Number(splitQty[salesOrderLineId]) || openQty(line);
      }
      return payload;
    });
    const res = await apiClient.post(`/sales-orders/${props.record._id}/split`, { lines });
    if (!res?.success) {
      notifications.error(res?.message || t('records.salesOrderSplitFailed'));
      return;
    }
    notifications.success(t('records.salesOrderSplitSuccess'));
    if (typeof props.context?.onSectionUpdated === 'function') {
      props.context.onSectionUpdated({ sectionKey: 'lineage', payload: { type: 'soft-refresh' } });
    }
    if (res?.data?.child?._id) {
      await router.push(`/sales-orders/${res.data.child._id}`);
    }
  } catch (e) {
    notifications.error(e?.message || t('records.salesOrderSplitFailed'));
  } finally {
    busy.value = false;
  }
}
</script>
