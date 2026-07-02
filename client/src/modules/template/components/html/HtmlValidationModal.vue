<template>
  <TransitionRoot as="template" :show="open">
    <Dialog class="relative z-[65]" @close="emit('close')">
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
            <DialogPanel class="w-full max-w-3xl rounded-xl bg-white dark:bg-gray-900 shadow-xl">
              <div class="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ t('templates.htmlImport.validationTitle') }}
                </DialogTitle>
              </div>

              <div class="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-4">
                <p v-if="validating" class="text-sm text-gray-500 dark:text-gray-400">
                  {{ t('templates.htmlImport.validating') }}
                </p>
                <p v-else-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>

                <template v-else-if="result">
                  <ValidationGroup
                    :title="t('templates.htmlImport.validationErrors')"
                    :items="result.errors"
                    tone="error"
                    :empty-label="t('templates.htmlImport.validationNone')"
                  />
                  <ValidationGroup
                    :title="t('templates.htmlImport.validationWarnings')"
                    :items="result.warnings"
                    tone="warning"
                    :empty-label="t('templates.htmlImport.validationNone')"
                  />
                  <ValidationGroup
                    :title="t('templates.htmlImport.validationSuggestions')"
                    :items="result.suggestions"
                    tone="info"
                    :empty-label="t('templates.htmlImport.validationNone')"
                  />
                </template>
              </div>

              <div class="flex justify-end border-t border-gray-200 dark:border-gray-700 px-6 py-4">
                <button type="button" class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600" @click="emit('close')">
                  {{ t('actions.close') }}
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
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import ValidationGroup from './HtmlValidationGroup.vue';

defineProps({
  open: { type: Boolean, default: false },
  validating: { type: Boolean, default: false },
  error: { type: String, default: '' },
  result: { type: Object, default: null }
});

const emit = defineEmits(['close']);

const { t } = useI18n();
</script>
