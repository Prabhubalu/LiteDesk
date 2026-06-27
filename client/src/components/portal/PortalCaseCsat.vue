<template>
  <section :class="['overflow-hidden', PLATFORM_HOME_CARD_CLASS]">
    <div :class="['px-4 py-3 sm:px-5', PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS]">
      <h2 class="text-sm font-semibold text-neutral-900 dark:text-white">
        {{ t('cases.portalCaseCsatTitle') }}
      </h2>
      <p class="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
        {{ t('cases.portalCaseCsatHint') }}
      </p>
    </div>

    <div v-if="submitted" class="px-4 py-5 sm:px-5">
      <p class="text-sm font-medium text-success-700 dark:text-success-400">
        {{ t('cases.portalCaseCsatThanks', { score: submittedScore }) }}
      </p>
    </div>

    <form v-else class="space-y-4 px-4 py-5 sm:px-5" @submit.prevent="submit">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="value in 5"
          :key="value"
          type="button"
          class="inline-flex h-11 w-11 items-center justify-center rounded-xl border text-sm font-semibold transition-colors"
          :class="score === value
            ? 'border-primary-500 bg-primary-600 text-white'
            : [PLATFORM_HOME_INSET_CONTROL_CLASS, 'text-neutral-700 dark:text-neutral-200']"
          :aria-label="t('cases.portalCaseCsatRate', { score: value })"
          @click="score = value"
        >
          {{ value }}
        </button>
      </div>

      <textarea
        v-model="comment"
        rows="3"
        class="w-full rounded-xl px-3 py-2.5 text-sm text-neutral-900 dark:text-white"
        :class="PLATFORM_HOME_INSET_CONTROL_CLASS"
        :placeholder="t('cases.portalCaseCsatCommentPlaceholder')"
      />

      <p v-if="error" class="text-sm text-danger-600 dark:text-danger-400">{{ error }}</p>

      <button
        type="submit"
        class="inline-flex min-h-11 items-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        :disabled="!score || submitting"
      >
        {{ submitting ? t('cases.portalCaseCsatSubmitting') : t('cases.portalCaseCsatSubmit') }}
      </button>
    </form>
  </section>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePortalCases } from '@/composables/usePortalCases';
import { capturePortalCaseCsatSubmitted } from '@/config/posthogPortal';
import {
  PLATFORM_HOME_CARD_CLASS,
  PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS,
  PLATFORM_HOME_INSET_CONTROL_CLASS
} from '@/utils/platformHomeLayout';

const props = defineProps({
  caseId: { type: String, required: true },
  csatSubmitted: { type: Boolean, default: false },
  csatScore: { type: Number, default: null }
});

const emit = defineEmits(['submitted']);

const { t } = useI18n();
const { submitCsat } = usePortalCases();

const score = ref(null);
const comment = ref('');
const submitting = ref(false);
const error = ref(null);
const submitted = ref(props.csatSubmitted);
const submittedScore = ref(props.csatScore);

watch(
  () => props.csatSubmitted,
  (value) => {
    submitted.value = value;
    submittedScore.value = props.csatScore;
  }
);

async function submit() {
  if (!score.value || !props.caseId) return;
  submitting.value = true;
  error.value = null;
  try {
    const res = await submitCsat(props.caseId, {
      score: score.value,
      comment: comment.value.trim() || undefined
    });
    if (res.success) {
      submitted.value = true;
      submittedScore.value = score.value;
      capturePortalCaseCsatSubmitted({
        case_id: props.caseId,
        score: score.value
      });
      emit('submitted', { score: score.value });
    } else {
      error.value = res.message || t('cases.portalCaseCsatFailed');
    }
  } catch (err) {
    error.value = err.message || t('cases.portalCaseCsatFailed');
  } finally {
    submitting.value = false;
  }
}
</script>
