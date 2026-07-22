<template>
  <section class="astra-assist rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
    <header class="px-4 py-2.5">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('astra.toolsHeading') }}</h3>
    </header>

    <div class="flex flex-wrap gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
      <button
        type="button"
        class="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        :disabled="asking"
        @click="run(t('astra.emailAssist'))"
      >
        {{ t('astra.emailAssist') }}
      </button>
      <button
        type="button"
        class="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        :disabled="asking"
        @click="run(t('astra.meetingAssist'))"
      >
        {{ t('astra.meetingAssist') }}
      </button>
    </div>

    <div v-if="asking || answer || error" class="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
      <p v-if="asking" class="text-sm text-gray-500 dark:text-gray-400">{{ t('astra.thinking') }}</p>
      <p
        v-else-if="answer"
        class="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-100"
      >
        {{ answer }}
      </p>
      <p v-if="error" class="mt-2 text-xs text-red-600 dark:text-red-400">{{ error }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAstraAsk } from '@/astra/composables/useAstraAsk';

const props = defineProps<{
  moduleKey?: string;
  recordId?: string;
}>();

const { t } = useI18n();
const { asking, error, askSync } = useAstraAsk('email_meeting_assist');

const answer = ref('');

async function run(prompt: string) {
  answer.value = '';
  const result = await askSync(prompt, { moduleKey: props.moduleKey, recordId: props.recordId });
  if (result) answer.value = result.answer;
}
</script>
