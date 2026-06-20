<template>
  <Dialog :open="isOpen" class="relative z-50" @close="emit('cancel')">
    <div class="fixed inset-0 bg-black/40" aria-hidden="true" />
    <div class="fixed inset-0 flex items-center justify-center p-4">
      <DialogPanel class="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900">
        <DialogTitle class="text-base font-semibold text-gray-900 dark:text-white">
          {{ t('documents.versionConflictTitle') }}
        </DialogTitle>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {{ t('documents.versionConflictMessage') }}
        </p>
        <p class="mt-2 text-sm text-gray-700 dark:text-gray-200">
          {{ t('documents.versionConflictDetail', { baseVersion, currentVersion }) }}
        </p>
        <div class="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200"
            @click="emit('cancel')"
          >
            {{ t('documents.versionConflictCancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200"
            @click="emit('compare')"
          >
            {{ t('documents.versionConflictCompare') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            :disabled="forcing"
            @click="emit('force-upload')"
          >
            {{ t('documents.versionConflictCreateAnyway') }}
          </button>
        </div>
      </DialogPanel>
    </div>
  </Dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/vue';

defineProps({
  isOpen: { type: Boolean, default: false },
  baseVersion: { type: [Number, String], default: null },
  currentVersion: { type: [Number, String], default: null },
  forcing: { type: Boolean, default: false }
});

const emit = defineEmits(['cancel', 'compare', 'force-upload']);
const { t } = useI18n();
</script>
