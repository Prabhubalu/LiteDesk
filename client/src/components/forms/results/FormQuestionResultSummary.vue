<template>
  <article
    class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
  >
    <div class="border-b border-gray-100 px-5 py-4 dark:border-gray-700/80 sm:px-6">
      <div class="flex items-start gap-3">
        <span
          class="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
        >
          {{ questionNumber }}
        </span>
        <div class="min-w-0 flex-1">
          <h4 class="text-base font-semibold leading-snug text-gray-900 dark:text-white">
            {{ question.questionText }}
            <span v-if="question.mandatory" class="ml-0.5 text-red-500">*</span>
          </h4>
          <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            <span>{{ typeLabel }}</span>
            <span>{{ t('forms.resultsSummaryAnsweredCount', { answered: question.answeredCount, total: question.totalResponses }) }}</span>
            <span>{{ t('forms.resultsSummaryResponseRate', { rate: question.responseRate }) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="px-5 py-5 sm:px-6">
      <div v-if="question.answeredCount === 0" class="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center dark:border-gray-600">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('forms.resultsSummaryNoAnswers') }}</p>
      </div>

      <FormSummaryChoiceBars
        v-else-if="summaryKind === 'choice'"
        :options="question.summary.options"
      />

      <FormSummaryRatingDistribution
        v-else-if="summaryKind === 'rating'"
        :average="question.summary.average"
        :distribution="question.summary.distribution"
      />

      <div v-else-if="summaryKind === 'text'" class="space-y-3">
        <div
          v-for="(entry, index) in visibleTextResponses"
          :key="`${index}-${entry.submittedAt}`"
          class="rounded-lg border border-gray-100 bg-gray-50/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40"
        >
          <p class="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">{{ entry.text }}</p>
          <p v-if="entry.submittedAt" class="mt-2 text-xs text-gray-400 dark:text-gray-500">
            {{ formatDate(entry.submittedAt) }}
          </p>
        </div>

        <button
          v-if="question.summary.hasMore && !expanded"
          type="button"
          class="text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
          @click="handleExpandText"
        >
          {{ t('forms.resultsSummaryShowAllText', { count: question.summary.totalTextResponses }) }}
        </button>
        <button
          v-else-if="expanded && question.summary.hasMore"
          type="button"
          class="text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
          @click="expanded = false"
        >
          {{ t('forms.resultsSummaryShowLess') }}
        </button>
      </div>

      <div
        v-else-if="summaryKind === 'media'"
        class="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/80 px-4 py-4 dark:border-gray-700 dark:bg-gray-900/40"
      >
        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40">
          <PaperClipIcon class="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <p class="text-sm font-semibold text-gray-900 dark:text-white">
            {{ t('forms.resultsSummaryMediaCount', { count: question.summary.uploadedCount }) }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('forms.resultsSummaryMediaHint') }}</p>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { PaperClipIcon } from '@heroicons/vue/24/outline';
import FormSummaryChoiceBars from './FormSummaryChoiceBars.vue';
import FormSummaryRatingDistribution from './FormSummaryRatingDistribution.vue';

const props = defineProps({
  question: { type: Object, required: true },
  questionNumber: { type: Number, required: true }
});

const emit = defineEmits(['expand-text']);

const { t, locale } = useI18n();
const expanded = ref(false);

const summaryKind = computed(() => props.question?.summary?.kind || 'text');

const typeLabel = computed(() => {
  const keyByType = {
    Dropdown: 'forms.resultsSummaryTypeDropdown',
    'Yes-No': 'forms.resultsSummaryTypeYesNo',
    Rating: 'forms.resultsSummaryTypeRating',
    Text: 'forms.resultsSummaryTypeText',
    Textarea: 'forms.resultsSummaryTypeTextarea',
    Number: 'forms.resultsSummaryTypeNumber',
    File: 'forms.resultsSummaryTypeFile',
    Signature: 'forms.resultsSummaryTypeSignature'
  };
  const key = keyByType[props.question?.type];
  return key ? t(key) : props.question?.type;
});

const visibleTextResponses = computed(() => props.question?.summary?.preview || []);

function handleExpandText() {
  expanded.value = true;
  if (props.question?.summary?.hasMore) {
    emit('expand-text', props.question.questionId);
  }
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return String(value);
  }
}
</script>
