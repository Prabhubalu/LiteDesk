<template>
  <div :class="containerClass">
    <slot v-if="shouldShowLoading" name="loading">
      <div
        class="flex flex-1 items-center justify-center min-h-[200px]"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div class="flex flex-col items-center text-center">
          <ArivuShimmerLogo size="lg" />
          <p class="mt-4 text-sm font-medium text-gray-600 dark:text-gray-400">
            {{ resolvedLoadingMessage }}
          </p>
        </div>
      </div>
    </slot>

    <slot v-else-if="shouldShowError" name="error" :error="errorMessage">
      <div class="flex items-center justify-center min-h-[200px] flex-1 p-4">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ resolvedErrorTitle }}</h2>
          <p class="text-gray-600 dark:text-gray-400 mb-6">{{ errorMessage }}</p>
          <button
            type="button"
            @click="$emit('retry')"
            class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            {{ resolvedRetryLabel }}
          </button>
        </div>
      </div>
    </slot>

    <template v-else>
      <RecordPageLayout v-if="useLayout" v-bind="layoutProps">
        <template #header>
          <slot name="header" />
        </template>
        <template #left>
          <slot name="left" />
        </template>
        <template #right>
          <slot name="right" />
        </template>
      </RecordPageLayout>
      <slot v-else />
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ArivuShimmerLogo from '@/components/common/ArivuShimmerLogo.vue';
import RecordPageLayout from './RecordPageLayout.vue';

const { t } = useI18n();

const props = defineProps({
  loading: { type: Boolean, default: false },
  showLoading: { type: Boolean, default: true },
  error: { type: [String, Object], default: null },
  loadingMessage: { type: String, default: '' },
  errorTitle: { type: String, default: '' },
  retryLabel: { type: String, default: '' },
  useLayout: { type: Boolean, default: true },
  layoutProps: {
    type: Object,
    default: () => ({})
  },
  containerClass: {
    type: [String, Array, Object],
    default: 'flex-1 min-h-0 overflow-hidden flex flex-col'
  }
});

defineEmits(['retry']);

const resolvedLoadingMessage = computed(() => props.loadingMessage || t('states.loading'));
const resolvedErrorTitle = computed(() => props.errorTitle || t('records.shellErrorTitle'));
const resolvedRetryLabel = computed(() => props.retryLabel || t('actions.retry'));

const shouldShowLoading = computed(() => props.loading && props.showLoading);
const shouldShowError = computed(() => !shouldShowLoading.value && Boolean(props.error));

const errorMessage = computed(() => {
  if (typeof props.error === 'string') return props.error;
  if (props.error && typeof props.error === 'object') {
    return String(props.error.message || t('records.shellLoadFailed'));
  }
  return t('records.shellLoadFailed');
});
</script>