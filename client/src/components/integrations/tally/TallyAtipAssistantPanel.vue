<template>
  <div class="mx-auto max-w-3xl space-y-4">
    <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
      <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyAssistantTitle') }}</h2>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {{ t('settings.tallyAssistantDesc') }}
      </p>

      <div class="mt-4 max-h-80 space-y-3 overflow-auto rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
        <div v-if="!messages.length" class="py-8 text-center text-sm text-gray-500">
          {{ t('settings.tallyAssistantEmpty') }}
        </div>
        <div
          v-for="(m, idx) in messages"
          :key="idx"
          class="rounded-lg px-3 py-2 text-sm"
          :class="m.role === 'user'
            ? 'ml-8 bg-indigo-600 text-white'
            : 'mr-8 bg-white text-gray-800 shadow-sm dark:bg-gray-800 dark:text-gray-100'"
        >
          {{ m.text }}
        </div>
      </div>

      <form class="mt-4 flex gap-2" @submit.prevent="ask">
        <input
          v-model="question"
          type="text"
          :placeholder="t('settings.tallyAssistantPlaceholder')"
          class="min-w-0 flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          :disabled="busy"
        />
        <button
          type="submit"
          class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          :disabled="busy || !question.trim()"
        >
          {{ busy ? t('states.loading') : t('settings.tallyAssistantAsk') }}
        </button>
      </form>
      <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  companyGuid: { type: String, default: '' },
});

const { t } = useI18n();
const question = ref('');
const messages = ref([]);
const busy = ref(false);
const error = ref('');

async function ask() {
  const q = question.value.trim();
  if (!q) return;
  messages.value.push({ role: 'user', text: q });
  question.value = '';
  busy.value = true;
  error.value = '';
  try {
    const res = await apiClient.post('/connectors/tally/atip/assistant', {
      question: q,
      companyGuid: props.companyGuid || null,
    });
    const data = res?.data || res;
    const answer = data?.answer || data?.message || (typeof data === 'string' ? data : JSON.stringify(data));
    messages.value.push({ role: 'assistant', text: answer });
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('settings.tallyAssistantFailed');
    messages.value.push({ role: 'assistant', text: error.value });
  } finally {
    busy.value = false;
  }
}
</script>
