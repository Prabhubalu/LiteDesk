<template>
  <div
    v-if="visible"
    class="border-b border-indigo-100 bg-indigo-50/70 px-4 py-2 sm:px-5 dark:border-indigo-900/40 dark:bg-indigo-950/30"
  >
    <div class="mb-1 flex items-center justify-between gap-2">
      <span class="text-xs font-semibold text-indigo-800 dark:text-indigo-200">
        {{ t('records.aiSummaryTitle') }}
      </span>
      <div class="flex items-center gap-2">
        <div v-if="summary && !error" class="inline-flex items-center gap-1">
          <button
            type="button"
            class="rounded px-1.5 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:text-indigo-200 dark:hover:bg-indigo-900/50"
            :disabled="feedbackSent"
            @click="sendFeedback('up')"
          >
            {{ t('records.aiFeedbackUp') }}
          </button>
          <button
            type="button"
            class="rounded px-1.5 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:text-indigo-200 dark:hover:bg-indigo-900/50"
            :disabled="feedbackSent"
            @click="sendFeedback('down')"
          >
            {{ t('records.aiFeedbackDown') }}
          </button>
        </div>
        <button
          type="button"
          class="text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-100"
          @click="clear"
        >
          {{ t('actions.close') }}
        </button>
      </div>
    </div>
    <p v-if="summarizing" class="text-xs text-indigo-700 dark:text-indigo-300">
      {{ t('records.aiSummarizing') }}
    </p>
    <p v-else-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
    <template v-else>
      <p
        v-if="cached"
        class="mb-1 text-[11px] font-medium text-indigo-600/80 dark:text-indigo-300/80"
      >
        {{ t('records.aiSummaryCached') }}
      </p>
      <pre class="whitespace-pre-wrap font-sans text-xs leading-relaxed text-indigo-950 dark:text-indigo-100">{{ summary }}</pre>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { submitAiFeedback, trackAiAbilityUsed } from '@/utils/aiFeedback';

const props = defineProps({
  sourceType: {
    type: String,
    required: true,
    validator: (value) => ['case', 'deal', 'people'].includes(value),
  },
  recordId: {
    type: String,
    default: '',
  },
});

const { t } = useI18n();

const summarizing = ref(false);
const summary = ref('');
const error = ref('');
const cached = ref(false);
const feedbackSent = ref(false);
const lastMeta = ref({ provider: '', model: '', keyMode: '' });

const visible = computed(
  () => Boolean(summarizing.value || summary.value || error.value)
);

const endpointByType = {
  case: (id) => `/ai/cases/${id}/summarize`,
  deal: (id) => `/ai/deals/${id}/summarize`,
  people: (id) => `/ai/people/${id}/summarize`,
};

function clear() {
  summarizing.value = false;
  summary.value = '';
  error.value = '';
  cached.value = false;
  feedbackSent.value = false;
}

async function summarize({ forceRefresh = false } = {}) {
  const id = String(props.recordId || '').trim();
  if (!id || summarizing.value) return;
  summarizing.value = true;
  summary.value = '';
  error.value = '';
  cached.value = false;
  feedbackSent.value = false;
  try {
    const path = endpointByType[props.sourceType](id);
    const data = await apiClient.post(path, { forceRefresh: Boolean(forceRefresh) });
    const text = String(data?.text || '').trim();
    if (!text) {
      error.value = t('records.aiSummaryEmpty');
      return;
    }
    summary.value = text;
    cached.value = Boolean(data?.cached);
    lastMeta.value = {
      provider: data?.provider || '',
      model: data?.model || '',
      keyMode: data?.keyMode || '',
    };
    trackAiAbilityUsed({
      abilityKey: 'summarize',
      provider: data?.provider,
      model: data?.model,
    });
  } catch (err) {
    error.value = err?.message || t('records.aiSummarizeFailed');
  } finally {
    summarizing.value = false;
  }
}

async function sendFeedback(rating) {
  if (feedbackSent.value) return;
  feedbackSent.value = true;
  await submitAiFeedback({
    rating,
    abilityKey: 'summarize',
    provider: lastMeta.value.provider,
    model: lastMeta.value.model,
    keyMode: lastMeta.value.keyMode,
    sourceType: props.sourceType,
    sourceId: props.recordId,
  });
}

watch(
  () => props.recordId,
  () => {
    clear();
  }
);

defineExpose({
  summarize,
  clear,
  summarizing,
});
</script>
