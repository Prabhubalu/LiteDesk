<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 backdrop-blur-[1px] px-4 py-6"
      @click.self="$emit('close')"
    >
      <div
        class="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <h3 :id="titleId" class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ dialogTitle }}
        </h3>
        <p class="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
          {{ t('cases.recordResolutionDialogDescription') }}
        </p>
        <label class="mt-5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('cases.recordResolutionDialogLabel') }}
          <textarea
            :value="modelValue"
            rows="5"
            class="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            @input="$emit('update:modelValue', $event.target.value)"
          />
        </label>
        <div class="mt-5 flex justify-end gap-2.5">
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            :disabled="submitting"
            @click="$emit('close')"
          >
            {{ t('cases.recordResolutionDialogCancel') }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            :disabled="submitting"
            @click="$emit('confirm')"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  show: { type: Boolean, default: false },
  modelValue: { type: String, default: '' },
  pendingStatus: { type: String, default: '' },
  submitting: { type: Boolean, default: false }
});

defineEmits(['close', 'confirm', 'update:modelValue']);

const { t } = useI18n();

const titleId = 'case-resolution-dialog-title';

const dialogTitle = computed(() => {
  const st = props.pendingStatus;
  if (st === 'Closed') return t('cases.recordResolutionDialogTitleClose');
  if (st === 'Resolved') return t('cases.recordResolutionDialogTitleResolve');
  return t('cases.recordResolutionDialogTitle');
});

const confirmLabel = computed(() => {
  const st = props.pendingStatus;
  if (st === 'Closed') return t('cases.recordResolutionDialogConfirmClose');
  if (st === 'Resolved') return t('cases.recordResolutionDialogConfirmResolve');
  return t('cases.recordResolutionDialogConfirm');
});
</script>
