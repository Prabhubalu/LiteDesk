<template>
  <div>
    <p class="text-sm font-medium text-gray-900 dark:text-white">
      {{ question.questionText }}
      <span v-if="question.mandatory" class="ml-0.5 text-red-500">*</span>
    </p>

    <div class="mt-3">
      <p class="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {{ t('forms.hubEngagementResponseAnswer') }}
      </p>

      <div v-if="isEmpty" class="text-sm italic text-gray-400 dark:text-gray-500">
        {{ t('forms.hubResponseDetailNoAnswerProvided') }}
      </div>

      <div v-else-if="question.type === 'Rating'" class="flex items-center gap-3">
        <div class="flex gap-0.5" aria-hidden="true">
          <svg
            v-for="star in 5"
            :key="star"
            class="h-6 w-6"
            :class="star <= ratingValue ? 'text-amber-400' : 'text-gray-200 dark:text-gray-600'"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>
        <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ ratingValue }} / 5</span>
      </div>

      <div v-else-if="question.type === 'Yes-No'">
        <span
          class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
          :class="yesNoPillClass"
        >
          {{ yesNoLabel }}
        </span>
      </div>

      <div v-else-if="question.type === 'Signature' && signatureUrl">
        <img
          :src="signatureUrl"
          :alt="t('forms.hubEngagementResponseSignatureAlt')"
          class="max-h-24 rounded-lg border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-900"
        />
      </div>

      <div v-else-if="(question.type === 'File' || hasAttachments) && fileLinks.length" class="flex flex-wrap gap-2">
        <a
          v-for="(fileUrl, index) in fileLinks"
          :key="index"
          :href="fileUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
        >
          <PaperClipIcon class="h-3.5 w-3.5" />
          {{ fileName(fileUrl) }}
        </a>
      </div>

      <div
        v-else-if="question.type === 'Textarea'"
        class="whitespace-pre-wrap rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      >
        {{ textAnswer }}
      </div>

      <div
        v-else
        class="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      >
        {{ textAnswer }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { PaperClipIcon } from '@heroicons/vue/24/outline';
import { formatUserDate } from '@/utils/localeFormat';

const props = defineProps({
  question: { type: Object, required: true },
  responseDetail: { type: Object, default: null }
});

const { t } = useI18n();

const rawAnswer = computed(() => props.responseDetail?.answer);

const isEmpty = computed(() => {
  const answer = rawAnswer.value;
  if (answer === null || answer === undefined || answer === '') return true;
  if (Array.isArray(answer) && answer.length === 0) return true;
  return false;
});

const ratingValue = computed(() => {
  const value = parseFloat(rawAnswer.value);
  return Number.isNaN(value) ? 0 : Math.min(5, Math.max(0, Math.round(value)));
});

const yesNoLabel = computed(() => {
  const normalized = String(rawAnswer.value || '').toLowerCase();
  if (normalized === 'yes' || normalized === 'true') return t('forms.hubEngagementResponseYes');
  if (normalized === 'no' || normalized === 'false') return t('forms.hubEngagementResponseNo');
  return String(rawAnswer.value ?? '');
});

const yesNoPillClass = computed(() => {
  const normalized = String(rawAnswer.value || '').toLowerCase();
  if (normalized === 'yes' || normalized === 'true') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
  }
  if (normalized === 'no' || normalized === 'false') {
    return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
  }
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
});

const signatureUrl = computed(() => {
  if (typeof rawAnswer.value === 'string' && rawAnswer.value.startsWith('http')) {
    return rawAnswer.value;
  }
  return null;
});

const hasAttachments = computed(() => (props.responseDetail?.attachments || []).length > 0);

const fileLinks = computed(() => {
  const links = [];
  if (typeof rawAnswer.value === 'string' && rawAnswer.value.startsWith('http')) {
    links.push(rawAnswer.value);
  }
  (props.responseDetail?.attachments || []).forEach((url) => {
    if (url && !links.includes(url)) links.push(url);
  });
  return links;
});

const textAnswer = computed(() => {
  const answer = rawAnswer.value;
  if (answer === null || answer === undefined) return '';
  if (Array.isArray(answer)) return answer.join(', ');
  if (typeof answer === 'object') return JSON.stringify(answer);
  if (props.question.type === 'Date' && answer) {
    const date = new Date(answer);
    if (!Number.isNaN(date.getTime())) {
      return formatUserDate(date);
    }
  }
  return String(answer);
});

function fileName(url) {
  return String(url).split('/').pop() || t('forms.hubEngagementResponseAttachment');
}
</script>
