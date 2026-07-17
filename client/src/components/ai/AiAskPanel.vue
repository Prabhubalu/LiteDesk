<template>
  <section :class="embedded ? '' : 'rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800'">
    <h3
      v-if="showTitle"
      class="text-base font-semibold text-gray-900 dark:text-white"
    >
      {{ mode === 'graph' ? t('records.aiAskGraph') : t('settings.aiAskTitle') }}
    </h3>
    <p
      v-if="showTitle"
      class="mt-1 text-sm text-gray-600 dark:text-gray-400"
    >
      {{ mode === 'graph' ? t('settings.aiAskGraphHint') : t('settings.aiAskHint') }}
    </p>

    <textarea
      v-model="question"
      rows="3"
      class="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
      :placeholder="t('settings.aiAskPlaceholder')"
      @keydown.meta.enter.prevent="runAsk"
      @keydown.ctrl.enter.prevent="runAsk"
    />

    <div class="mt-3 flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
        :disabled="asking || !question.trim()"
        @click="runAsk"
      >
        {{ asking ? t('settings.aiAskRunning') : t('settings.aiAskSubmit') }}
      </button>
      <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
    </div>

    <div v-if="notConfigured" class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
      <p class="text-sm text-amber-800 dark:text-amber-200">{{ t('settings.aiAskNotConfigured') }}</p>
    </div>

    <div v-else-if="answer" class="mt-4 space-y-3">
      <pre class="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 font-sans text-sm text-gray-900 dark:bg-gray-900 dark:text-gray-100">{{ answer }}</pre>
      <ul v-if="citations.length" class="space-y-1 text-xs text-gray-600 dark:text-gray-400">
        <li v-for="citation in citations" :key="citation.chunkId || citation.index">
          [{{ citation.index }}] {{ citation.sourceType }} · {{ citation.sourceId }}
          <span class="text-gray-400">({{ Number(citation.score || 0).toFixed(2) }})</span>
          <p v-if="citation.excerpt" class="mt-0.5 line-clamp-2 text-gray-500 dark:text-gray-500">
            {{ citation.excerpt }}
          </p>
        </li>
      </ul>
      <p v-else class="text-xs text-amber-700 dark:text-amber-300">{{ t('settings.aiAskNoCitations') }}</p>
      <div class="inline-flex items-center gap-2">
        <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.aiAskFeedbackPrompt') }}</span>
        <button
          type="button"
          class="rounded px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700"
          :disabled="feedbackSent"
          @click="sendFeedback('up')"
        >
          {{ t('settings.aiAskFeedbackUp') }}
        </button>
        <button
          type="button"
          class="rounded px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700"
          :disabled="feedbackSent"
          @click="sendFeedback('down')"
        >
          {{ t('settings.aiAskFeedbackDown') }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { submitAiFeedback, trackAiAbilityUsed } from '@/utils/aiFeedback';
import { captureAiProviderError } from '@/config/posthogAi';

const props = defineProps({
  /** Optional corpus filter: document | article */
  sourceType: { type: String, default: '' },
  /** Prefill question (e.g. case title) */
  initialQuestion: { type: String, default: '' },
  showTitle: { type: Boolean, default: true },
  /** Compact layout when nested in a rail panel */
  embedded: { type: Boolean, default: false },
  /** knowledge = Docs/Articles RAG; graph = CRM record-context Q&A */
  mode: {
    type: String,
    default: 'knowledge',
    validator: (value) => ['knowledge', 'graph'].includes(value),
  },
  appKey: { type: String, default: 'SALES' },
  moduleKey: { type: String, default: '' },
  recordId: { type: String, default: '' },
});

const { t } = useI18n();

const question = ref('');
const asking = ref(false);
const answer = ref('');
const error = ref('');
const citations = ref([]);
const feedbackSent = ref(false);
const notConfigured = ref(false);
const lastMeta = ref({ provider: '', model: '', keyMode: '', found: false });

watch(
  () => props.initialQuestion,
  (value) => {
    if (!question.value.trim() && value) {
      question.value = String(value).trim();
    }
  },
  { immediate: true }
);

async function runAsk() {
  const q = question.value.trim();
  if (!q || asking.value) return;
  asking.value = true;
  error.value = '';
  answer.value = '';
  citations.value = [];
  feedbackSent.value = false;
  notConfigured.value = false;
  try {
    const body = { question: q };
    if (props.mode === 'graph') {
      body.moduleKey = props.moduleKey;
      body.recordId = props.recordId;
      body.appKey = props.appKey;
    } else if (props.sourceType) {
      body.sourceType = props.sourceType;
    }
    const path = props.mode === 'graph' ? '/ai/ask-graph' : '/ai/ask';
    const data = await apiClient.post(path, body);
    answer.value = String(data?.answer || '').trim();
    citations.value = Array.isArray(data?.citations) ? data.citations : [];
    lastMeta.value = {
      provider: data?.provider || '',
      model: data?.model || '',
      keyMode: data?.keyMode || '',
      found: Boolean(data?.found),
    };
    trackAiAbilityUsed({
      abilityKey: props.mode === 'graph' ? 'work_graph_ask' : 'ask',
      provider: data?.provider,
      model: data?.model,
      found: data?.found,
      keyMode: data?.keyMode,
      tokens: data?.usage?.totalTokens,
    });
    if (!answer.value) {
      error.value = t('settings.aiAskEmpty');
    }
  } catch (err) {
    const code = err?.response?.data?.code || err?.code || '';
    if (
      code === 'AI_NOT_CONFIGURED'
      || code === 'AI_SUITE_NOT_ENTITLED'
      || code === 'AI_KEY_NOT_CONFIGURED'
      || code === 'AI_DISABLED'
      || code === 'AI_CONSENT_REQUIRED'
      || Boolean(err?.response?.data?.notConfigured)
    ) {
      notConfigured.value = true;
    } else {
      error.value = err?.message || t('settings.aiAskFailed');
      captureAiProviderError({
        abilityKey: 'ask',
        code: String(code || 'AI_ASK_FAILED'),
      });
    }
  } finally {
    asking.value = false;
  }
}

async function sendFeedback(rating) {
  if (feedbackSent.value) return;
  feedbackSent.value = true;
  await submitAiFeedback({
    rating,
    abilityKey: 'ask',
    provider: lastMeta.value.provider,
    model: lastMeta.value.model,
    keyMode: lastMeta.value.keyMode,
    found: lastMeta.value.found,
  });
}

defineExpose({ runAsk, question });
</script>
