<template>
  <div v-if="show" class="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
    <div class="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-lg space-y-4">
      <h4 class="text-base font-semibold text-gray-900 dark:text-white">
        {{ t('records.salesOrderMergeTitle') }}
      </h4>
      <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('records.salesOrderMergeHint') }}</p>

      <ul class="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 text-sm">
        <li
          v-for="row in orders"
          :key="row._id || row.salesOrderId"
          class="px-3 py-2 flex items-center justify-between gap-2"
        >
          <span class="font-medium text-gray-900 dark:text-gray-100 truncate">
            {{ row.salesOrderNumber || row.salesOrderId }}
          </span>
          <span class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ row.orderTitle || '—' }}</span>
        </li>
      </ul>

      <label class="block space-y-1">
        <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('records.salesOrderMergeTitleLabel') }}</span>
        <input
          v-model="orderTitle"
          type="text"
          class="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          :disabled="saving"
        />
      </label>

      <div class="flex justify-end gap-2 pt-1">
        <button type="button" class="px-3 py-2 text-sm" :disabled="saving" @click="emit('close')">
          {{ t('actions.cancel') }}
        </button>
        <button
          type="button"
          class="px-3 py-2 text-sm rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
          :disabled="saving || orders.length < 2"
          @click="submit"
        >
          {{ t('records.salesOrderMergeAction') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  show: { type: Boolean, default: false },
  orders: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'submit']);

const { t } = useI18n();
const orderTitle = ref('');

watch(
  () => [props.show, props.orders],
  () => {
    if (!props.show) return;
    const labels = (props.orders || [])
      .map((row) => row.salesOrderNumber || row.salesOrderId)
      .filter(Boolean);
    orderTitle.value = labels.length >= 2 ? `Merged ${labels.join(' + ')}` : '';
  },
  { immediate: true, deep: true }
);

function submit() {
  emit('submit', { orderTitle: orderTitle.value.trim() || undefined });
}
</script>
