<template>
  <div class="space-y-4 px-1 py-2">
    <div v-if="!lines.length" class="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
      {{ t('records.rnNoLines') }}
    </div>

    <div v-else class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/50">
          <tr class="text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <th class="px-3 py-2">{{ t('records.rnColProduct') }}</th>
            <th class="px-3 py-2">{{ t('records.rnColOrdered') }}</th>
            <th class="px-3 py-2">{{ t('records.rnColPrevReceived') }}</th>
            <th class="px-3 py-2">{{ t('records.rnColPending') }}</th>
            <th class="px-3 py-2">{{ t('records.rnColReceived') }}</th>
            <th class="px-3 py-2">{{ t('records.rnColAccepted') }}</th>
            <th class="px-3 py-2">{{ t('records.rnColRejected') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr v-for="line in lines" :key="lineKey(line)" class="text-gray-900 dark:text-gray-100">
            <td class="px-3 py-2">
              <div class="font-medium">{{ line.itemNameSnapshot || line.skuSnapshot || '—' }}</div>
              <div v-if="line.skuSnapshot" class="text-xs text-gray-500">{{ line.skuSnapshot }}</div>
            </td>
            <td class="px-3 py-2 tabular-nums">{{ num(line.quantityOrdered) }}</td>
            <td class="px-3 py-2 tabular-nums">{{ num(line.quantityPreviouslyReceived) }}</td>
            <td class="px-3 py-2 tabular-nums">{{ num(line.quantityPending) }}</td>
            <td class="px-3 py-2 tabular-nums">{{ num(line.quantityReceived) }}</td>
            <td class="px-3 py-2 tabular-nums">{{ num(line.quantityAccepted) }}</td>
            <td class="px-3 py-2 tabular-nums">{{ num(line.quantityRejected) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) },
  adapter: { type: Object, default: null }
});

const { t } = useI18n();

const lines = computed(() => (Array.isArray(props.record?.lines) ? props.record.lines : []));

function lineKey(line) {
  return String(line?._id || line?.purchaseOrderLineId || line?.variantId || Math.random());
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
</script>
