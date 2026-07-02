<template>
  <TransitionRoot as="template" :show="open">
    <Dialog class="relative z-[70]" @close="emit('cancel')">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-150"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-900/50" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto p-4">
        <div class="flex min-h-full items-center justify-center">
          <TransitionChild
            as="template"
            enter="ease-out duration-200"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="ease-in duration-150"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel class="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl">
              <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t('templates.htmlImport.editWarningTitle') }}
              </DialogTitle>
              <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {{ t('templates.htmlImport.editWarningBody') }}
              </p>
              <label class="mt-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <input v-model="dontShowAgain" type="checkbox" class="rounded border-gray-300 dark:border-gray-600" />
                {{ t('templates.htmlImport.editWarningDismiss') }}
              </label>
              <div class="mt-6 flex justify-end gap-2">
                <button type="button" class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600" @click="emit('cancel')">
                  {{ t('actions.cancel') }}
                </button>
                <button type="button" class="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700" @click="confirm">
                  {{ t('templates.htmlImport.editWarningConfirm') }}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';

import { dismissEmailHtmlWarning } from '../../utils/emailHtmlWarning';

defineProps({
  open: { type: Boolean, default: false }
});

const emit = defineEmits(['cancel', 'confirm']);

const { t } = useI18n();
const dontShowAgain = ref(false);

function confirm() {
  if (dontShowAgain.value) {
    dismissEmailHtmlWarning();
  }
  emit('confirm');
}
</script>
