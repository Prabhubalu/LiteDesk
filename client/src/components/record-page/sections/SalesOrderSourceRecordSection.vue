<template>
  <section v-if="sourceQuoteId" class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-sm">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <div class="text-gray-500 dark:text-gray-400">{{ t('records.salesOrderSourceQuote') }}</div>
        <div class="font-medium text-gray-900 dark:text-gray-100">
          {{ sourceLabel }}
        </div>
      </div>
      <button
        type="button"
        class="inline-flex items-center rounded-md border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
        @click="openQuote"
      >
        {{ t('records.salesOrderViewQuote') }}
      </button>
    </div>
    <p v-if="record?.sourceRevisionNumber" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
      {{ t('records.quoteRevisionLabel', { n: record.sourceRevisionNumber }) }}
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  record: { type: Object, default: null }
});

const { t } = useI18n();
const router = useRouter();

const sourceQuoteId = computed(() => {
  const ref = props.record?.sourceQuoteId;
  if (!ref) return null;
  if (typeof ref === 'object') return ref._id || ref.id || null;
  return ref;
});

const sourceLabel = computed(() => {
  const ref = props.record?.sourceQuoteId;
  if (ref && typeof ref === 'object') {
    const num = ref.quoteNumber || props.record?.sourceQuoteNumber;
    const title = ref.quoteTitle;
    if (num && title) return `${num} · ${title}`;
    if (num) return String(num);
  }
  return props.record?.sourceQuoteNumber || String(sourceQuoteId.value || '').slice(-8) || '—';
});

function openQuote() {
  if (!sourceQuoteId.value) return;
  router.push({ name: 'quote-detail', params: { id: String(sourceQuoteId.value) } });
}
</script>
