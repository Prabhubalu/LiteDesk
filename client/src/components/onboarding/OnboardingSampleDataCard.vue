<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { SparklesIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  offer: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['accept', 'decline']);

const { t } = useI18n();

const isVisible = computed(() => Boolean(props.offer?.available));

const templateLabel = computed(() => {
  const key = props.offer?.templateKey || 'sales_default';
  const labelKey = `onboarding.sampleDataTemplate_${key}`;
  return t(labelKey);
});
</script>

<template>
  <section
    v-if="isVisible"
    class="rounded-lg border border-brand-200 bg-brand-50 p-6 shadow-sm dark:border-brand-800 dark:bg-brand-950/30"
  >
    <div class="flex items-start gap-3">
      <SparklesIcon class="mt-0.5 h-6 w-6 flex-shrink-0 text-brand-600 dark:text-brand-400" />
      <div class="flex-1">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">
          {{ t('onboarding.sampleDataTitle') }}
        </h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('onboarding.sampleDataDescription', { template: templateLabel }) }}
        </p>
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-500">
          {{ t('onboarding.sampleDataNote') }}
        </p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            :disabled="loading"
            @click="emit('accept')"
          >
            {{ t('onboarding.sampleDataAccept') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            :disabled="loading"
            @click="emit('decline')"
          >
            {{ t('onboarding.sampleDataDecline') }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
