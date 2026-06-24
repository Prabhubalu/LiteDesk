<template>
  <div>
    <div
      v-if="showSummaryTab"
      class="mb-4 inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900/60"
      role="tablist"
      :aria-label="t('forms.resultsSummaryViewToggle')"
    >
      <button
        type="button"
        role="tab"
        class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        :class="activeView === 'summary'
          ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white'
          : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'"
        :aria-selected="activeView === 'summary'"
        @click="activeView = 'summary'"
      >
        {{ t('forms.resultsSummaryTabSummary') }}
      </button>
      <button
        type="button"
        role="tab"
        class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        :class="activeView === 'individual'
          ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white'
          : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'"
        :aria-selected="activeView === 'individual'"
        @click="activeView = 'individual'"
      >
        {{ t('forms.resultsSummaryTabIndividual') }}
      </button>
    </div>

    <FormRecordResultsSummarySection
      v-if="activeView === 'summary'"
      :summary="context.formResponseSummary"
      :loading="context.formResponseSummaryLoading"
      :form-name="record?.name || ''"
      @expand-text="handleExpandText"
    />

    <FormRecordResponsesSection
      v-else
      :record="record"
      :adapter="adapter"
      :context="context"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { isEngagementFormType } from '@/utils/engagementFormDisplay';
import FormRecordResultsSummarySection from '@/components/forms/results/FormRecordResultsSummarySection.vue';
import FormRecordResponsesSection from '@/components/record-page/sections/FormRecordResponsesSection.vue';

const props = defineProps({
  record: { type: Object, default: null },
  adapter: { type: Object, default: () => ({}) },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();

const showSummaryTab = computed(() => isEngagementFormType(props.record?.formType));

const activeView = ref('summary');

watch(
  () => props.context?.formResponseSummary?.overview?.totalResponses,
  (total) => {
    if (!showSummaryTab.value) {
      activeView.value = 'individual';
      return;
    }
    activeView.value = total > 0 ? 'summary' : 'individual';
  },
  { immediate: true }
);

function handleExpandText(_questionId) {
  props.context?.fetchFormResponseSummary?.({ textPreviewLimit: 200 });
}
</script>
